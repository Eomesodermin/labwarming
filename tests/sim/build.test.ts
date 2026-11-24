import { describe, expect, it } from 'vitest';
import { EQUIPMENT, investedFunds, maxTier } from '../../src/content/equipment';
import { ROOMS } from '../../src/content/rooms';
import { PLAYER_ID } from '../../src/sim/commands';
import { baseTile, isWalkable } from '../../src/sim/grid';
import { findPath, pathCacheSize } from '../../src/sim/pathfinding';
import { pathWarnings, placementBlocker, sellInfo, upgradeInfo } from '../../src/sim/placement';
import { step } from '../../src/sim/step';
import { incubatorWithFreeSlot, slotsOf } from '../../src/sim/systems/cultures';
import type { Equipment, GameState } from '../../src/sim/types';
import { equip, newGame, rejections, run, stand } from './helpers';

function buy(state: GameState, plotId: string, room: 'lab' | 'washup' | 'break' | 'office' | 'media'): string[] {
  return rejections(step(state, [{ type: 'BuyPlot', plotId, roomType: room }]));
}

function put(state: GameState, defId: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): Equipment {
  const id = `t${state.nextId++}`;
  const eq: Equipment = { id, defId, tier: 1, x, y, rot, broken: false, cycle: null };
  state.equipment[id] = eq;
  state.gridVersion += 1;
  return eq;
}

/** A game with the Wash-up Room built on plot b (interior x 11 to 18, y 2 to 7, door at (14,8)). */
function withWashup(): GameState {
  const s = newGame();
  s.funds = 2000;
  expect(buy(s, 'b', 'washup')).toEqual([]);
  return s;
}

describe('buying plots', () => {
  it('turns a plot into a room, charges the cost and adds the free spray station', () => {
    const s = newGame();
    expect(buy(s, 'b', 'washup')).toEqual([]);
    expect(s.funds).toBe(100);
    expect(s.plots['b']).toMatchObject({ owned: true, roomType: 'washup' });
    const spray = Object.values(s.equipment).find((e) => e.defId === 'spray' && e.x === 15 && e.y === 7);
    expect(spray).toBeDefined();
    expect(placementBlocker(s, 'sink', 15, 7, 0)).toBe('Something is already there');
  });

  it('opens the door so the player can walk in', () => {
    const s = newGame();
    expect(isWalkable(s, 14, 8)).toBe(false);
    expect(findPath(s, { x: 14, y: 9 }, { x: 14, y: 6 })).toBeNull();
    buy(s, 'b', 'washup');
    expect(isWalkable(s, 14, 8)).toBe(true);
    const path = findPath(s, { x: 14, y: 9 }, { x: 14, y: 6 });
    expect(path).not.toBeNull();
    expect(path?.length).toBe(3);
  });

  it('puts the spray station by the door in rooms below the corridor too', () => {
    const s = newGame();
    s.funds = 2000;
    buy(s, 'e', 'break');
    const spray = Object.values(s.equipment).find((e) => e.defId === 'spray' && e.x === 15 && e.y === 12);
    expect(spray?.rot).toBe(0);
    expect(placementBlocker(s, 'plant', 14, 12, 0)).toBe('Keep the door clear');
  });

  it('refuses when Funds are short, when the plot is owned and for locked rooms', () => {
    const s = newGame();
    expect(buy(s, 'b', 'lab')).toEqual(['Needs 600 Funds']);
    expect(buy(s, 'a', 'washup')).toEqual(['You already own this plot']);
    s.funds = 5000;
    expect(buy(s, 'b', 'office')).toEqual(['Needs Reputation 20']);
    expect(buy(s, 'b', 'media')).toEqual(['Needs Reputation 30']);
    s.reputation = 20;
    expect(buy(s, 'b', 'office')).toEqual([]);
    expect(s.funds).toBe(5000 - 350);
  });

  it('does not charge for a refused purchase', () => {
    const s = newGame();
    buy(s, 'b', 'lab');
    expect(s.funds).toBe(500);
    expect(s.gridVersion).toBe(1);
  });
});

describe('placement rules', () => {
  it('allows an autoclave only in a Wash-up Room', () => {
    const s = withWashup();
    expect(placementBlocker(s, 'autoclave', 3, 3, 0)).toMatch(/^Not for a Lab\. Try: Wash-up Room/);
    expect(placementBlocker(s, 'autoclave', 12, 3, 0)).toBeNull();
    expect(placementBlocker(s, 'bench', 12, 3, 0)).toMatch(/^Not for a Wash-up Room/);
  });

  it('keeps the door tile and the tile inside it clear', () => {
    const s = withWashup();
    expect(placementBlocker(s, 'bin', 14, 7, 0)).toBe('Keep the door clear');
    expect(placementBlocker(s, 'autoclave', 13, 7, 2)).toBe('Keep the door clear'); // covers (13,7) and (14,7)
    expect(placementBlocker(s, 'bin', 14, 8, 0)).toBe('Must go inside a room');
  });

  it('refuses a front against a wall', () => {
    const s = withWashup();
    expect(placementBlocker(s, 'sink', 12, 2, 2)).toBe('The front is against a wall'); // faces the top wall
    expect(placementBlocker(s, 'sink', 12, 2, 0)).toBeNull();
    expect(placementBlocker(s, 'sink', 11, 4, 1)).toBe('The front is against a wall'); // faces the left wall
  });

  it('refuses overlaps, unowned plots, the corridor and items spanning two rooms', () => {
    const s = withWashup();
    put(s, 'bin', 12, 3);
    expect(placementBlocker(s, 'sink', 12, 3, 0)).toBe('Something is already there');
    expect(placementBlocker(s, 'sink', 21, 3, 0)).toBe('Buy this plot first');
    expect(placementBlocker(s, 'sink', 6, 9, 0)).toBe('Must go inside a room');
    expect(placementBlocker(s, 'desk', 9, 5, 0)).toBe('Must go inside a room'); // it would cross the wall
  });

  it('refuses a front that something blocks, and a front that cannot be reached from the door', () => {
    const s = withWashup();
    put(s, 'bin', 12, 3);
    expect(placementBlocker(s, 'sink', 12, 2, 0)).toBe('Something blocks the front');
    // A row of bins across the room cuts the top half off from the door.
    for (let x = 11; x <= 18; x++) put(s, 'bin', x, 5);
    expect(placementBlocker(s, 'sink', 14, 2, 0)).toBe('No way to walk to the front from the door');
    expect(placementBlocker(s, 'sink', 14, 6, 0)).toBeNull();
  });

  it('refuses a tile the player stands on', () => {
    const s = newGame();
    expect(placementBlocker(s, 'bin', 5, 5, 0)).toBe('Someone is standing there');
    expect(placementBlocker(s, 'bin', 6, 5, 0)).toBeNull();
  });

  it('does not charge or build when placement is refused', () => {
    const s = withWashup();
    const before = s.funds;
    const n = Object.keys(s.equipment).length;
    const ev = step(s, [{ type: 'PlaceEquipment', defId: 'autoclave', x: 3, y: 3, rot: 0 }]);
    expect(rejections(ev)[0]).toMatch(/^Not for a Lab/);
    expect(s.funds).toBe(before);
    expect(Object.keys(s.equipment)).toHaveLength(n);
  });

  it('places equipment, charges the price and bumps the grid version', () => {
    const s = withWashup();
    const v = s.gridVersion;
    step(s, [{ type: 'PlaceEquipment', defId: 'autoclave', x: 12, y: 3, rot: 0 }]);
    const eq = equip(s, 'autoclave');
    expect(eq).toMatchObject({ x: 12, y: 3, tier: 1, cycle: null });
    expect(s.funds).toBe(2000 - 400 - 300);
    expect(s.gridVersion).toBe(v + 1);
    expect(isWalkable(s, 12, 3)).toBe(false);
    expect(isWalkable(s, 13, 3)).toBe(false);
  });

  it('refuses a purchase the player cannot afford', () => {
    const s = withWashup();
    s.funds = 100;
    const ev = step(s, [{ type: 'PlaceEquipment', defId: 'autoclave', x: 12, y: 3, rot: 0 }]);
    expect(rejections(ev)).toEqual(['Needs 300 Funds']);
  });

  it('keeps every starting piece valid in its own place', () => {
    const s = newGame();
    for (const eq of Object.values(s.equipment)) {
      if (eq.defId === 'bay') continue;
      expect(placementBlocker(s, eq.defId, eq.x, eq.y, eq.rot, { ignoreId: eq.id }) ?? 'ok', eq.defId).toBe(eq.defId === 'spray' ? 'That cannot be built' : 'ok');
    }
  });

  it('gives the bay no catalogue entry', () => {
    expect(EQUIPMENT['bay']?.price).toBeNull();
    expect(placementBlocker(newGame(), 'bay', 3, 3, 0)).toBe('That cannot be built');
  });
});

describe('moving equipment', () => {
  it('is free and the player can use it in the new place', () => {
    const s = newGame();
    const bench = equip(s, 'bench');
    const funds = s.funds;
    const v = s.gridVersion;
    step(s, [{ type: 'MoveEquipment', equipmentId: bench.id, x: 3, y: 4, rot: 0 }]);
    expect(rejections([])).toEqual([]);
    expect(bench).toMatchObject({ x: 3, y: 4 });
    expect(s.funds).toBe(funds);
    expect(s.gridVersion).toBe(v + 1);
    expect(isWalkable(s, 5, 2)).toBe(true);
    expect(isWalkable(s, 3, 4)).toBe(false);

    s.cultures.push({ id: 'c1', incubatorId: equip(s, 'incubator').id, growTicksLeft: 0, status: 'ready' });
    const before = s.data;
    stand(s, 'bench');
    step(s, [{ type: 'Interact', jobId: 'runExperiment' }]);
    run(s, 200);
    expect(s.data).toBeGreaterThan(before);
  });

  it('applies the same rules as placing, ignoring itself', () => {
    const s = newGame();
    const bench = equip(s, 'bench');
    const ev = step(s, [{ type: 'MoveEquipment', equipmentId: bench.id, x: 5, y: 2, rot: 2 }]);
    expect(rejections(ev)).toEqual(['The front is against a wall']);
    expect(bench.rot).toBe(0);
    // Rotating in place is fine.
    expect(placementBlocker(s, 'bench', 5, 2, 0, { ignoreId: bench.id })).toBeNull();
  });

  it('refuses to move the delivery bay', () => {
    const s = newGame();
    const ev = step(s, [{ type: 'MoveEquipment', equipmentId: equip(s, 'bay').id, x: 3, y: 3, rot: 0 }]);
    expect(rejections(ev)).toEqual(['That cannot be moved']);
  });

  it('stops a walk that would cross the new position', () => {
    const s = newGame();
    const p = s.agents[PLAYER_ID] as NonNullable<GameState['agents'][string]>;
    step(s, [{ type: 'SetPlayerTarget', x: 5, y: 3 }]);
    expect(p.path.length).toBeGreaterThan(0);
    const bench = equip(s, 'bench');
    s.clock.speed = 1;
    step(s, [{ type: 'MoveEquipment', equipmentId: bench.id, x: 5, y: 3, rot: 0 }]);
    // The bench landed on the goal, so the walk was cancelled rather than walking through it.
    expect(p.path.some((t) => t.x === 5 && t.y === 3)).toBe(false);
  });
});

describe('selling', () => {
  it('returns half of everything paid', () => {
    const s = newGame();
    const sink = equip(s, 'sink');
    const funds = s.funds;
    step(s, [{ type: 'SellEquipment', equipmentId: sink.id }]);
    expect(s.equipment[sink.id]).toBeUndefined();
    expect(s.funds).toBe(funds + 50);
    expect(isWalkable(s, 2, 7)).toBe(true);
  });

  it('counts upgrades in the refund', () => {
    const s = newGame();
    const inc = equip(s, 'incubator');
    inc.tier = 2;
    expect(investedFunds('incubator', 2)).toBe(400);
    expect(sellInfo(s, inc).refund).toBe(200);
  });

  it('refuses things that are not for sale or still in use', () => {
    const s = newGame();
    expect(rejections(step(s, [{ type: 'SellEquipment', equipmentId: equip(s, 'bay').id }]))).toEqual(['This cannot be sold']);
    expect(rejections(step(s, [{ type: 'SellEquipment', equipmentId: equip(s, 'spray').id }]))).toEqual(['This cannot be sold']);
    const inc = equip(s, 'incubator');
    s.cultures.push({ id: 'c1', incubatorId: inc.id, growTicksLeft: 100, status: 'growing' });
    expect(rejections(step(s, [{ type: 'SellEquipment', equipmentId: inc.id }]))).toEqual(['Empty the incubator first']);
    // The only fridge holds the stock.
    expect(rejections(step(s, [{ type: 'SellEquipment', equipmentId: equip(s, 'fridge').id }]))).toEqual(['The stock would not fit without it']);
  });

  it('removes the jobs at a sold station', () => {
    const s = newGame();
    stand(s, 'desk');
    s.data = 100;
    step(s, [{ type: 'Interact', jobId: 'writePaper' }]);
    run(s, 10);
    expect(Object.keys(s.jobs)).toHaveLength(1);
    step(s, [{ type: 'SellEquipment', equipmentId: equip(s, 'desk').id }]);
    expect(Object.keys(s.jobs)).toHaveLength(0);
    expect(s.agents[PLAYER_ID]?.jobId).toBeNull();
  });
});

describe('upgrading', () => {
  it('upgrades the incubator to 4 slots that can all be filled', () => {
    const s = newGame();
    const inc = equip(s, 'incubator');
    expect(slotsOf(inc)).toBe(2);
    step(s, [{ type: 'UpgradeEquipment', equipmentId: inc.id }]);
    expect(inc.tier).toBe(2);
    expect(s.funds).toBe(250);
    expect(slotsOf(inc)).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(incubatorWithFreeSlot(s)).toBe(inc);
      s.cultures.push({ id: `c${i}`, incubatorId: inc.id, growTicksLeft: 100, status: 'growing' });
    }
    expect(incubatorWithFreeSlot(s)).toBeNull();
  });

  it('checks Funds, Reputation, repair and the last tier', () => {
    const s = newGame();
    const inc = equip(s, 'incubator');
    inc.tier = 2;
    s.funds = 1000;
    expect(upgradeInfo(s, inc).blocker).toBe('Needs Reputation 60');
    s.reputation = 60;
    s.funds = 100;
    expect(upgradeInfo(s, inc).blocker).toBe('Needs 500 Funds');
    s.funds = 600;
    expect(upgradeInfo(s, inc).blocker).toBeNull();
    inc.tier = 3;
    expect(upgradeInfo(s, inc)).toMatchObject({ blocker: 'Fully upgraded', hasNext: false });
    expect(upgradeInfo(s, equip(s, 'fridge')).blocker).toBe('Repair it first');
    expect(maxTier('sofa')).toBe(1);
    expect(rejections(step(s, [{ type: 'UpgradeEquipment', equipmentId: equip(s, 'fridge').id }]))).toEqual(['Repair it first']);
  });

  it('makes tier stats take effect: hood, bench, sink, shelf, bin, fridge and desk', () => {
    const s = newGame();
    s.funds = 5000;
    s.reputation = 100;
    for (const id of ['bench', 'hood', 'sink', 'shelf', 'bin', 'desk']) {
      step(s, [{ type: 'UpgradeEquipment', equipmentId: equip(s, id).id }]);
      expect(equip(s, id).tier, id).toBe(2);
    }
    step(s, [{ type: 'RepairEquipment', equipmentId: equip(s, 'fridge').id }]);
    step(s, [{ type: 'UpgradeEquipment', equipmentId: equip(s, 'fridge').id }]);
    expect(equip(s, 'fridge').tier).toBe(2);
    s.cultures.push({ id: 'c1', incubatorId: equip(s, 'incubator').id, growTicksLeft: 0, status: 'ready' });
    stand(s, 'bench');
    step(s, [{ type: 'Interact', jobId: 'runExperiment' }]);
    expect(Object.values(s.jobs)[0]?.totalTicks).toBe(120);
  });

  it('writes faster at a tier 2 desk', () => {
    const s = newGame();
    s.data = 100;
    equip(s, 'desk').tier = 2;
    stand(s, 'desk');
    step(s, [{ type: 'Interact', jobId: 'writePaper' }]);
    expect(Object.values(s.jobs)[0]?.totalTicks).toBe(160);
  });
});

describe('the autoclave', () => {
  function setup(): { s: GameState; eq: Equipment } {
    const s = withWashup();
    step(s, [{ type: 'PlaceEquipment', defId: 'autoclave', x: 12, y: 3, rot: 0 }]);
    return { s, eq: equip(s, 'autoclave') };
  }

  it('takes dirty flasks, runs unattended and returns clean ones', () => {
    const { s, eq } = setup();
    s.stock.dirtyFlasks = 5;
    s.stock.cleanFlasks = 2;
    stand(s, 'autoclave');
    step(s, [{ type: 'Interact' }]);
    run(s, 60); // load takes 6 s
    expect(eq.cycle?.flasks).toBe(5);
    expect(s.stock.dirtyFlasks).toBe(0);
    // Walk away: it still runs.
    const p = s.agents[PLAYER_ID] as NonNullable<GameState['agents'][string]>;
    p.x = 14;
    p.y = 6;
    run(s, 398);
    expect(s.stock.cleanFlasks).toBe(2);
    run(s, 3);
    expect(s.stock.cleanFlasks).toBe(7);
    expect(eq.cycle).toBeNull();
    expect(s.stats.autoclaveCycles).toBe(1);
  });

  it('holds 8 flasks per cycle and leaves the rest', () => {
    const { s, eq } = setup();
    s.stock.dirtyFlasks = 12;
    stand(s, 'autoclave');
    step(s, [{ type: 'Interact' }]);
    run(s, 70);
    expect(eq.cycle?.flasks).toBe(8);
    expect(s.stock.dirtyFlasks).toBe(4);
  });

  it('is busy while running and refuses an empty load', () => {
    const { s, eq } = setup();
    stand(s, 'autoclave');
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['Needs 1 dirty flask']);
    eq.cycle = { flasks: 3, ticksLeft: 200 };
    s.stock.dirtyFlasks = 4;
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['Running, 20 s left']);
  });

  it('keeps flasks inside while the shelf is full and releases them when there is room', () => {
    const { s, eq } = setup();
    eq.cycle = { flasks: 3, ticksLeft: 1 };
    s.stock.cleanFlasks = 11; // the one shelf holds 12
    s.stock.mediaPowder = 0;
    run(s, 3);
    expect(s.stock.cleanFlasks).toBe(12);
    expect(eq.cycle?.flasks).toBe(2);
    s.stock.cleanFlasks = 0;
    run(s, 2);
    expect(eq.cycle).toBeNull();
    expect(s.stock.cleanFlasks).toBe(2);
  });

  it('runs a tier 2 cycle faster and holds more', () => {
    const { s, eq } = setup();
    eq.tier = 2;
    s.stock.dirtyFlasks = 20;
    stand(s, 'autoclave');
    step(s, [{ type: 'Interact' }]);
    run(s, 70);
    expect(eq.cycle?.flasks).toBe(16);
    expect(eq.cycle?.ticksLeft).toBeLessThanOrEqual(300);
  });

  it('cannot be moved or sold mid-cycle', () => {
    const { s, eq } = setup();
    eq.cycle = { flasks: 3, ticksLeft: 50 };
    expect(rejections(step(s, [{ type: 'MoveEquipment', equipmentId: eq.id, x: 14, y: 4, rot: 0 }]))).toEqual(['Wait for the cycle to finish']);
    expect(rejections(step(s, [{ type: 'SellEquipment', equipmentId: eq.id }]))).toEqual(['Wait for the cycle to finish']);
  });
});

describe('the coffee machine', () => {
  it('gives the player a speed boost after a break', () => {
    const s = newGame();
    s.funds = 3000;
    buy(s, 'e', 'break');
    step(s, [{ type: 'PlaceEquipment', defId: 'coffee', x: 12, y: 13, rot: 0 }]);
    stand(s, 'coffee');
    step(s, [{ type: 'Interact' }]);
    run(s, 200);
    expect(s.flags['coffeeTicks']).toBeGreaterThan(0);
    s.data = 100;
    stand(s, 'desk');
    step(s, [{ type: 'Interact', jobId: 'writePaper' }]);
    const job = Object.values(s.jobs)[0];
    expect(job?.totalTicks).toBe(200);
    run(s, 150);
    expect(job?.progressTicks).toBeGreaterThanOrEqual(164); // one extra tick in every ten
    expect(job?.progressTicks).toBeLessThanOrEqual(166);
  });

  it('takes 20 s, or 12 s at tier 2', () => {
    const s = newGame();
    s.funds = 3000;
    buy(s, 'e', 'break');
    step(s, [{ type: 'PlaceEquipment', defId: 'coffee', x: 12, y: 13, rot: 0 }]);
    stand(s, 'coffee');
    step(s, [{ type: 'Interact' }]);
    expect(Object.values(s.jobs)[0]?.totalTicks).toBe(200);
    equip(s, 'coffee').tier = 2;
    s.jobs = {};
    s.agents[PLAYER_ID]!.jobId = null;
    step(s, [{ type: 'Interact' }]);
    expect(Object.values(s.jobs)[0]?.totalTicks).toBe(120);
  });
});

describe('path cache invalidation and the no path warning', () => {
  it('drops cached paths when the grid changes', () => {
    const s = newGame();
    findPath(s, { x: 5, y: 5 }, { x: 5, y: 3 });
    expect(pathCacheSize(s)).toBe(1);
    put(s, 'bin', 5, 4);
    expect(pathCacheSize(s)).toBe(0);
    const route = findPath(s, { x: 5, y: 5 }, { x: 5, y: 3 });
    expect(route?.some((t) => t.x === 5 && t.y === 4)).toBe(false);
  });

  it('every build command bumps the grid version', () => {
    const s = withWashup();
    let v = s.gridVersion;
    const bump = (): number => {
      const ok = s.gridVersion > v;
      v = s.gridVersion;
      return ok ? 1 : 0;
    };
    step(s, [{ type: 'PlaceEquipment', defId: 'bin', x: 12, y: 3, rot: 0 }]);
    expect(bump()).toBe(1);
    step(s, [{ type: 'MoveEquipment', equipmentId: equip(s, 'bin').id, x: 13, y: 3, rot: 0 }]);
    expect(bump()).toBe(1);
    step(s, [{ type: 'SellEquipment', equipmentId: equip(s, 'bin').id }]);
    expect(bump()).toBe(1);
    step(s, [{ type: 'UpgradeEquipment', equipmentId: equip(s, 'desk').id }]);
    expect(bump()).toBe(0); // upgrades do not change walkability
  });

  it('has no warnings in a fresh game or a new room', () => {
    expect(pathWarnings(newGame())).toEqual([]);
    expect(pathWarnings(withWashup())).toEqual([]);
  });

  it('warns about equipment that nobody can walk up to', () => {
    const s = withWashup();
    const sink = put(s, 'sink', 11, 2, 0); // front tile (11,3)
    expect(pathWarnings(s)).toEqual([]);
    put(s, 'bin', 11, 3, 3); // a bin sits on the sink's only front tile
    const w = pathWarnings(s);
    expect(w).toEqual([{ equipmentId: sink.id, text: 'No path to the sink' }]);
  });

  it('warns when a wall of equipment seals off a part of a room', () => {
    const s = withWashup();
    const sink = put(s, 'sink', 12, 2, 0);
    for (let x = 11; x <= 18; x++) put(s, 'bin', x, 4);
    const w = pathWarnings(s).map((x) => x.equipmentId);
    expect(w).toContain(sink.id);
    // The wall itself can still be walked up to from below.
    expect(w).toHaveLength(1);
  });

  it('warns about every piece in a room whose door is sealed', () => {
    const s = withWashup();
    const sink = put(s, 'sink', 12, 3, 0);
    // Seal the tile inside the door (placement rules would forbid this, a hand-edited state can).
    put(s, 'bin', 14, 7, 0);
    expect(pathWarnings(s).map((x) => x.equipmentId)).toContain(sink.id);
    expect(baseTile(14, 8).kind).toBe('door');
  });

  it('ignores the delivery bay', () => {
    const s = newGame();
    expect(pathWarnings(s).some((w) => w.equipmentId === equip(s, 'bay').id)).toBe(false);
  });
});

describe('content', () => {
  it('has every room allow only real equipment and every price an integer', () => {
    for (const r of Object.values(ROOMS)) {
      for (const d of r.allows) expect(EQUIPMENT[d], `${r.id} allows ${d}`).toBeDefined();
      expect(Number.isInteger(r.cost) && r.cost >= 0).toBe(true);
    }
    for (const e of Object.values(EQUIPMENT)) {
      if (e.price !== null) expect(Number.isInteger(e.price) && e.price >= 0, e.id).toBe(true);
      for (const u of e.upgrades) expect(Number.isInteger(u.price) && u.price >= 0, e.id).toBe(true);
      // Stat lists have one entry per tier, or fewer when later tiers repeat the last one.
      for (const [k, list] of Object.entries(e.stats ?? {})) expect(list.length, `${e.id}.${k}`).toBeLessThanOrEqual(maxTier(e.id));
    }
  });

  it('lets every catalogue item be placed in at least one room', () => {
    for (const e of Object.values(EQUIPMENT)) {
      if (e.category === 'fixed') continue;
      expect(Object.values(ROOMS).some((r) => r.allows.includes(e.id)), e.id).toBe(true);
    }
  });

  it('uses no em dashes in room text', () => {
    for (const r of Object.values(ROOMS)) expect(r.note + r.name).not.toMatch(/—/);
  });
});
