import { describe, expect, it } from 'vitest';
import { FACILITY } from '../../src/content/facility';
import { ROOMS } from '../../src/content/rooms';
import { ROLES } from '../../src/content/staff';
import { PLOTS } from '../../src/content/map';
import { PLAYER_ID } from '../../src/sim/commands';
import { placementBlocker } from '../../src/sim/placement';
import { facilityView, stationMenu } from '../../src/sim/selectors';
import { serialize, deserialize } from '../../src/sim/save';
import { step } from '../../src/sim/step';
import { facilityOpen } from '../../src/sim/systems/facility';
import type { GameState, Rot } from '../../src/sim/types';
import { equip, newGame, rejections, run, stand } from './helpers';

function spot(s: GameState, defId: string, plotId: string): { x: number; y: number; rot: Rot } {
  const p = PLOTS.find((q) => q.id === plotId);
  if (!p) throw new Error('no plot');
  for (let y = p.y; y < p.y + p.h; y++)
    for (let x = p.x; x < p.x + p.w; x++)
      for (const rot of [0, 1, 2, 3] as Rot[]) if (placementBlocker(s, defId, x, y, rot) === null) return { x, y, rot };
  throw new Error('no spot');
}

/** A game with the fridge repaired, rich, with Reputation 30. The media room is not built yet. */
function richGame(seed = 1): GameState {
  const s = newGame(seed);
  s.funds = 5000;
  s.reputation = 30;
  s.flags['fridgeWarmDay'] = 1;
  for (const e of Object.values(s.equipment)) if (e.defId === 'fridge') e.broken = false;
  s.director.firedBeats.push('pi_quick_one');
  return s;
}

function openFacility(s: GameState): void {
  step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'media' }]);
  const at = spot(s, 'mediaprep', 'b');
  step(s, [{ type: 'PlaceEquipment', defId: 'mediaprep', ...at }]);
}

describe('the Media Facility room', () => {
  it('is locked below Reputation 30 with a clear reason, and opens the room type from 30', () => {
    const s = newGame();
    s.funds = 5000;
    s.reputation = 29;
    expect(rejections(step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'media' }]))).toEqual(['Needs Reputation 30']);
    expect(s.plots['b']?.owned).toBe(false);
    expect(facilityView(s).lockedText).toMatch(/Reputation 30/);
    s.reputation = 30;
    expect(rejections(step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'media' }]))).toEqual([]);
    expect(s.plots['b']?.roomType).toBe('media');
    expect(s.funds).toBe(5000 - ROOMS.media.cost);
  });

  it('is not open until a media prep unit stands inside, and the unit only goes in the Media Facility', () => {
    const s = richGame();
    expect(placementBlocker(s, 'mediaprep', 3, 3, 0)).toMatch(/Not for a Lab/);
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'media' }]);
    expect(facilityOpen(s)).toBe(false);
    expect(facilityView(s).lockedText).toMatch(/media prep unit/);
    const at = spot(s, 'mediaprep', 'b');
    const before = s.funds;
    step(s, [{ type: 'PlaceEquipment', defId: 'mediaprep', ...at }]);
    expect(s.funds).toBe(before - 400);
    expect(facilityOpen(s)).toBe(true);
  });

  it('cannot sell the prep unit while it is the facility', () => {
    const s = richGame();
    openFacility(s);
    const unit = equip(s, 'mediaprep');
    expect(rejections(step(s, [{ type: 'SellEquipment', equipmentId: unit.id }]))).toEqual(['The Media Facility needs its prep unit']);
  });
});

describe('the media technician', () => {
  it('arrives with the facility at no fee, at 50 a day, and cannot be parted with', () => {
    const s = richGame();
    expect(Object.values(s.agents).some((a) => a.staff?.role === 'mediatech')).toBe(false);
    openFacility(s);
    run(s, 2);
    const tech = Object.values(s.agents).find((a) => a.staff?.role === 'mediatech');
    expect(tech).toBeDefined();
    expect(tech?.staff?.salary).toBe(50);
    expect(ROLES.mediatech.fee).toBe(0);
    expect(Object.values(s.agents).filter((a) => a.staff?.role === 'mediatech')).toHaveLength(1);
    expect(rejections(step(s, [{ type: 'PartWays', agentId: tech?.id ?? '' }]))).toEqual(['The media technician comes with the Media Facility']);
    run(s, 200);
    expect(Object.values(s.agents).filter((a) => a.staff?.role === 'mediatech')).toHaveLength(1);
  });

  it('makes media on its own until stock reaches the target, one bottle every 15 s, 6 per powder', () => {
    const s = richGame();
    s.stock.media = 0;
    s.stock.mediaPowder = 2;
    s.facility.autoReorder = false;
    s.facility.visitorTicks = 1_000_000;
    openFacility(s);
    s.facility.visitorTicks = 1_000_000;
    run(s, 20 * 10); // the technician walks in
    const before = s.stats.prepBottles;
    run(s, 15 * 10 * 3);
    expect(s.stats.prepBottles - before).toBeGreaterThanOrEqual(2);
    expect(s.stats.prepBottles - before).toBeLessThanOrEqual(3);
    run(s, 15 * 10 * 12);
    expect(s.stock.media).toBe(s.facility.target);
    expect(s.stats.prepBottles).toBe(8);
    // 8 bottles took 2 powders: 6 from the first and 2 from the second, with 4 bottles still open.
    expect(s.stock.mediaPowder).toBe(0);
    expect(s.facility.batchLeft).toBe(4);
    run(s, 300);
    expect(s.stock.media).toBe(8); // it stops at the target
  });

  it('a hand-job at the unit works the same way and shows why it cannot run', () => {
    const s = richGame();
    s.stock.media = 8;
    s.facility.visitorTicks = 1_000_000;
    openFacility(s);
    s.facility.visitorTicks = 1_000_000;
    const unit = equip(s, 'mediaprep');
    stand(s, 'mediaprep');
    const menu = stationMenu(s, unit);
    expect(menu?.entries[0]?.reason).toBe('Media is at the target of 8');
    s.stock.media = 2;
    expect(stationMenu(s, unit)?.entries[0]?.reason).toBeNull();
    step(s, [{ type: 'Interact', stationId: unit.id, jobId: 'runMediaPrep' }]);
    run(s, FACILITY.bottleSec * 10 + 5);
    expect(s.stock.media).toBe(3);
  });
});

describe('the target slider', () => {
  it('clamps the target and the unit stops there', () => {
    const s = richGame();
    step(s, [{ type: 'SetMediaTarget', target: 99 }]);
    expect(s.facility.target).toBe(FACILITY.targetMax);
    step(s, [{ type: 'SetMediaTarget', target: -3 }]);
    expect(s.facility.target).toBe(FACILITY.targetMin);
    step(s, [{ type: 'SetMediaTarget', target: 5.4 }]);
    expect(s.facility.target).toBe(5);
    s.stock.media = 0;
    s.stock.mediaPowder = 2;
    s.facility.autoReorder = false;
    openFacility(s);
    s.facility.visitorTicks = 1_000_000;
    run(s, 15 * 10 * 12);
    expect(s.stock.media).toBe(5);
    step(s, [{ type: 'SetMediaTarget', target: 7 }]);
    run(s, 15 * 10 * 4);
    expect(s.stock.media).toBe(7);
  });
});

describe('auto-reorder', () => {
  function lowPowder(on: boolean): GameState {
    const s = richGame();
    openFacility(s);
    s.facility.visitorTicks = 1_000_000;
    s.facility.autoReorder = on;
    s.stock.mediaPowder = 1;
    return s;
  }

  it('orders one powder box when powder drops below 2, once while it is on the way', () => {
    const s = lowPowder(true);
    const funds = s.funds;
    run(s, 40);
    expect(s.orders.filter((o) => o.orderId === 'mediaPowderBox')).toHaveLength(1);
    expect(s.funds).toBe(funds - 30);
    run(s, 100);
    expect(s.orders.filter((o) => o.orderId === 'mediaPowderBox')).toHaveLength(1);
    run(s, 1500); // the box arrives and the technician puts it away once the bottles are made
    expect(s.boxes).toHaveLength(0);
    expect(s.stock.mediaPowder + (s.facility.batchLeft > 0 ? 1 : 0)).toBeGreaterThanOrEqual(3);
  });

  it('does nothing when it is off, and the switch is a command', () => {
    const s = lowPowder(false);
    run(s, 200);
    expect(s.orders).toHaveLength(0);
    step(s, [{ type: 'SetAutoReorder', on: true }]);
    expect(s.facility.autoReorder).toBe(true);
    run(s, 40);
    expect(s.orders).toHaveLength(1);
  });

  it('does not order when powder is 2 or more, and waits for funds', () => {
    const s = lowPowder(true);
    s.stock.mediaPowder = 2;
    run(s, 100);
    expect(s.orders).toHaveLength(0);
    s.stock.mediaPowder = 0;
    s.funds = 10;
    run(s, 100);
    expect(s.orders).toHaveLength(0);
  });
});

describe('visitors', () => {
  function readyForVisitors(): GameState {
    const s = richGame();
    openFacility(s);
    s.stock.media = 8;
    s.facility.target = 8;
    s.facility.autoReorder = false;
    s.stock.mediaPowder = 0;
    return s;
  }

  it('walk in, take 2 bottles, pay 15 each and walk out', () => {
    const s = readyForVisitors();
    s.facility.visitorTicks = 5;
    const funds = s.funds;
    run(s, 6);
    const visitor = Object.values(s.agents).find((a) => a.kind === 'visitor');
    expect(visitor).toBeDefined();
    expect(s.director.visits.some((v) => v.kind === 'media')).toBe(true);
    run(s, 400);
    expect(s.stats.mediaSold).toBe(2);
    expect(s.stats.visitorsServed).toBe(1);
    expect(s.funds - funds).toBe(30);
    expect(s.facility.earned).toBe(30);
    expect(s.stock.media).toBe(6);
    expect(Object.values(s.agents).some((a) => a.kind === 'visitor')).toBe(false);
    expect(s.director.visits).toHaveLength(0);
  });

  it('come every 60 to 90 s', () => {
    const s = readyForVisitors();
    s.facility.visitorTicks = 1;
    run(s, 2);
    expect(s.facility.visitorTicks).toBeGreaterThanOrEqual(600);
    expect(s.facility.visitorTicks).toBeLessThanOrEqual(900);
    const gaps: number[] = [];
    for (let i = 0; i < 6; i++) {
      s.facility.visitorTicks = 1;
      run(s, 2);
      gaps.push(s.facility.visitorTicks);
    }
    for (const g of gaps) expect(g >= 599 && g <= 900).toBe(true);
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  it('buy nothing when stock is at the reserve of 4 or below, and say so', () => {
    const s = readyForVisitors();
    s.facility.target = 2;
    s.stock.media = FACILITY.reserve;
    s.facility.visitorTicks = 5;
    const funds = s.funds;
    const events = run(s, 400);
    expect(s.funds).toBe(funds);
    expect(s.stock.media).toBe(FACILITY.reserve);
    expect(s.stats.mediaSold).toBe(0);
    expect(events.some((e) => e.type === 'Toast' && /thin|yourselves/.test(e.text))).toBe(true);
    s.stock.media = FACILITY.reserve + 1;
    s.facility.visitorTicks = 5;
    run(s, 400);
    expect(s.stats.mediaSold).toBe(2);
    expect(s.stock.media).toBe(FACILITY.reserve - 1);
  });

  it('do not come while the facility is closed, and the facility pays for its technician over a day', () => {
    const s = richGame();
    run(s, 3000);
    expect(s.stats.visitorsServed).toBe(0);
    openFacility(s);
    s.stock.mediaPowder = 6;
    s.facility.autoReorder = true;
    run(s, 2400 * 2);
    expect(s.stats.visitorsServed).toBeGreaterThanOrEqual(4);
    expect(s.facility.earned).toBeGreaterThanOrEqual(120);
  });
});

describe('saving the facility', () => {
  it('round trips the settings and carries on the same way', () => {
    const s = richGame();
    openFacility(s);
    step(s, [{ type: 'SetMediaTarget', target: 11 }, { type: 'SetAutoReorder', on: false }]);
    run(s, 500);
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
    run(s, 800);
    run(back, 800);
    expect(serialize(back)).toBe(serialize(s));
    expect(back.agents[PLAYER_ID]).toBeDefined();
  });
});
