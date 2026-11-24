import { describe, expect, it } from 'vitest';
import { FAILURES } from '../../src/content/events';
import { PLAYER_ID } from '../../src/sim/commands';
import { culturesSystem } from '../../src/sim/systems/cultures';
import { directorSystem } from '../../src/sim/systems/director';
import { machinesSystem } from '../../src/sim/systems/machines';
import { step } from '../../src/sim/step';
import { newGame, equip, lateGame, mails, markFired, rejections, run, setClock, stand } from './helpers';
import type { GameState } from '../../src/sim/types';
import type { SimEvent } from '../../src/sim/simEvents';

function addAutoclave(s: GameState): void {
  s.plots['b'] = { id: 'b', owned: true, roomType: 'washup', cleanliness: 100, waste: 0 };
  s.gridVersion += 1;
  s.equipment['eqA'] = { id: 'eqA', defId: 'autoclave', tier: 1, x: 12, y: 3, rot: 0, broken: false, cycle: null };
}

/** Starts a cycle that ends on the next tick, and runs the machine system once. */
function finishCycle(s: GameState): SimEvent[] {
  const ac = equip(s, 'autoclave');
  ac.cycle = { flasks: 4, ticksLeft: 1 };
  const ev: SimEvent[] = [];
  machinesSystem(s, ev);
  return ev;
}

describe('fail_fridge_warm', () => {
  it('costs one media at 13:00 once a day, and stops for good when the fridge is repaired', () => {
    const s = newGame();
    markFired(s);
    setClock(s, 1, 13, 4);
    run(s, 12);
    expect(s.stock.media).toBe(2);
    expect(mails(s, 'fail_fridge_warm')).toHaveLength(1);
    run(s, 100);
    expect(mails(s, 'fail_fridge_warm')).toHaveLength(1);
    s.clock.day = 2;
    s.clock.tickOfDay = 1190;
    run(s, 20);
    expect(s.stock.media).toBe(1);
    step(s, [{ type: 'RepairEquipment', equipmentId: equip(s, 'fridge').id }]);
    s.clock.day = 3;
    s.clock.tickOfDay = 1190;
    run(s, 20);
    expect(s.stock.media).toBe(1);
  });
});

describe('fail_contamination', () => {
  it('tells the player when a culture goes bad on its own', () => {
    const s = lateGame(7);
    const plotA = s.plots['a'];
    if (plotA) plotA.cleanliness = 0;
    s.stats.culturesGrown = 50;
    const inc = equip(s, 'incubator');
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      s.cultures = [{ id: `c${i}`, incubatorId: inc.id, growTicksLeft: 1, status: 'growing' }];
      s.flags['lastContaminated'] = false;
      culturesSystem(s, []);
      found = s.cultures[0]?.status === 'contaminated';
    }
    expect(found).toBe(true);
    expect(s.stats.contaminations).toBe(1);
    expect(mails(s, 'fail_contamination')).toHaveLength(1);
  });

  it('is scripted on Day 4 at 10:00 if none has happened: one culture goes bad and can be binned', () => {
    const s = newGame();
    markFired(s, ['fail_contamination']);
    const inc = equip(s, 'incubator');
    s.cultures = [{ id: 'c1', incubatorId: inc.id, growTicksLeft: 99, status: 'growing' }];
    setClock(s, 4, 10, 6);
    run(s, 12);
    expect(s.cultures[0]?.status).toBe('contaminated');
    expect(s.stats.contaminations).toBe(1);
    expect(mails(s, 'fail_contamination')).toHaveLength(1);
    stand(s, 'incubator');
    run(s, 1, [{ type: 'Interact', jobId: 'binCulture' }]);
    run(s, 40);
    expect(s.cultures).toHaveLength(0);
    expect(s.stats.binned).toBe(1);
  });

  it('is skipped on Day 4 if one has already happened, and waits for a culture to exist', () => {
    const a = newGame();
    markFired(a, ['fail_contamination']);
    a.stats.contaminations = 1;
    a.cultures = [{ id: 'c1', incubatorId: equip(a, 'incubator').id, growTicksLeft: 99, status: 'growing' }];
    setClock(a, 4, 10, 6);
    run(a, 30);
    expect(a.cultures[0]?.status).toBe('growing');
    const b = newGame();
    markFired(b, ['fail_contamination']);
    setClock(b, 4, 10, 6);
    run(b, 30);
    expect(mails(b, 'fail_contamination')).toHaveLength(0);
    b.cultures = [{ id: 'c1', incubatorId: equip(b, 'incubator').id, growTicksLeft: 99, status: 'growing' }];
    run(b, 12);
    expect(b.cultures[0]?.status).toBe('contaminated');
  });

  it('never happens by chance in the first 6 minutes', () => {
    const s = newGame(3);
    s.stats.culturesGrown = 50;
    const plotA = s.plots['a'];
    if (plotA) plotA.cleanliness = 0;
    const inc = equip(s, 'incubator');
    for (let i = 0; i < 300; i++) {
      s.cultures = [{ id: `c${i}`, incubatorId: inc.id, growTicksLeft: 1, status: 'growing' }];
      s.flags['lastContaminated'] = false;
      culturesSystem(s, []);
      expect(s.cultures[0]?.status).toBe('ready');
    }
  });
});

describe('fail_autoclave', () => {
  function breaker(): GameState {
    for (let seed = 1; seed < 400; seed++) {
      const s = lateGame(seed);
      addAutoclave(s);
      s.stats.autoclaveCycles = FAILURES.autoclave.safeCycles;
      finishCycle(s);
      if (equip(s, 'autoclave').broken) {
        const t = lateGame(seed);
        addAutoclave(t);
        t.stats.autoclaveCycles = FAILURES.autoclave.safeCycles;
        return t;
      }
    }
    throw new Error('no seed breaks it');
  }

  it('can break after its first 3 cycles, about 5 percent of the time, and never before', () => {
    let early = 0;
    let late = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const a = lateGame(seed);
      addAutoclave(a);
      a.stats.autoclaveCycles = 2;
      finishCycle(a);
      if (equip(a, 'autoclave').broken) early += 1;
      const b = lateGame(seed);
      addAutoclave(b);
      b.stats.autoclaveCycles = 3;
      finishCycle(b);
      if (equip(b, 'autoclave').broken) late += 1;
    }
    expect(early).toBe(0);
    expect(late).toBeGreaterThan(10);
    expect(late).toBeLessThan(60);
  });

  it('does not break in the first 6 minutes, and tier 2 never breaks', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = newGame(seed);
      addAutoclave(s);
      s.stats.autoclaveCycles = 9;
      finishCycle(s);
      expect(equip(s, 'autoclave').broken).toBe(false);
      const t = lateGame(seed);
      addAutoclave(t);
      equip(t, 'autoclave').tier = 2;
      t.stats.autoclaveCycles = 9;
      finishCycle(t);
      expect(equip(t, 'autoclave').broken).toBe(false);
    }
  });

  it('goes out of service, keeps the flasks inside, sends an email and blocks the job', () => {
    const s = breaker();
    const ev = finishCycle(s);
    const ac = equip(s, 'autoclave');
    expect(ac.broken).toBe(true);
    expect(ev.some((e) => e.type === 'EmailReceived' && e.kind === 'fail_autoclave')).toBe(true);
    expect(ac.cycle?.flasks).toBe(4);
    expect(s.stock.cleanFlasks).toBe(6);
    machinesSystem(s, []);
    expect(s.stock.cleanFlasks).toBe(6);
    s.stock.dirtyFlasks = 2;
    stand(s, 'autoclave');
    ac.cycle = null;
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'loadAutoclave' }]))[0]).toMatch(/Out of service/);
  });

  it('coaxing works about half the time and the flasks then come out', () => {
    const s = breaker();
    finishCycle(s);
    const ac = equip(s, 'autoclave');
    let tries = 0;
    while (ac.broken && tries < 50) {
      step(s, [{ type: 'CoaxAutoclave', equipmentId: ac.id }]);
      tries += 1;
    }
    expect(ac.broken).toBe(false);
    run(s, 3);
    expect(s.stock.cleanFlasks).toBeGreaterThan(6);
    let ok = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const t = lateGame(seed);
      addAutoclave(t);
      equip(t, 'autoclave').broken = true;
      step(t, [{ type: 'CoaxAutoclave', equipmentId: equip(t, 'autoclave').id }]);
      if (!equip(t, 'autoclave').broken) ok += 1;
    }
    expect(ok).toBeGreaterThan(70);
    expect(ok).toBeLessThan(130);
  });

  it('the engineer arrives in 30 s, the first call is free, later calls cost 50', () => {
    const s = lateGame(5);
    addAutoclave(s);
    const ac = equip(s, 'autoclave');
    ac.broken = true;
    s.funds = 100;
    step(s, [{ type: 'CallEngineer' }]);
    expect(s.funds).toBe(100);
    expect(ac.repairTicks).toBe(299);
    expect(rejections(step(s, [{ type: 'CallEngineer' }]))).toEqual(['The engineer is already on the way']);
    run(s, 290);
    expect(ac.broken).toBe(true);
    run(s, 15);
    expect(ac.broken).toBe(false);
    ac.broken = true;
    step(s, [{ type: 'CallEngineer' }]);
    expect(s.funds).toBe(50);
    ac.broken = false;
    ac.repairTicks = 0;
    ac.broken = true;
    s.funds = 10;
    expect(rejections(step(s, [{ type: 'CallEngineer' }]))).toEqual(['Needs 50 Funds']);
    expect(rejections(step(newGame(), [{ type: 'CallEngineer' }]))).toEqual(['Nothing is broken']);
  });

  it('the sink still works while the autoclave is out', () => {
    const s = lateGame(5);
    addAutoclave(s);
    equip(s, 'autoclave').broken = true;
    s.stock.dirtyFlasks = 1;
    stand(s, 'sink');
    run(s, 1, [{ type: 'Interact', jobId: 'washFlask' }]);
    run(s, 80);
    expect(s.stats.washes).toBe(1);
  });
});

describe('fail_lost_order', () => {
  function lostGame(): GameState {
    for (let seed = 1; seed < 400; seed++) {
      const s = lateGame(seed);
      s.stats.ordersPlaced = 4;
      s.funds = 1000;
      step(s, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
      if (s.orders[0]?.lost) {
        const t = lateGame(seed);
        t.stats.ordersPlaced = 4;
        t.funds = 1000;
        return t;
      }
    }
    throw new Error('no seed loses the order');
  }

  it('never happens in the first 4 orders, and not at all in the first 6 minutes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = lateGame(seed);
      s.funds = 1000;
      for (let i = 0; i < 4; i++) step(s, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
      expect(s.orders.some((o) => o.lost)).toBe(false);
      const t = newGame(seed);
      t.stats.ordersPlaced = 10;
      step(t, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
      expect(t.orders[0]?.lost).toBeUndefined();
    }
  });

  it('is rare: about 8 percent of later orders', () => {
    let lost = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const s = lateGame(seed);
      s.stats.ordersPlaced = 10;
      s.funds = 1000;
      step(s, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
      if (s.orders[0]?.lost) lost += 1;
    }
    expect(lost).toBeGreaterThan(15);
    expect(lost).toBeLessThan(70);
  });

  it('puts the box on a corridor tile, Bodo walks there, and the player picks it up by walking over it', () => {
    const s = lostGame();
    step(s, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
    const at = s.orders[0]?.dropAt;
    expect(at).toBeDefined();
    run(s, 301);
    expect(s.orders).toHaveLength(0);
    expect(s.boxes).toHaveLength(0);
    expect(s.lostBoxes).toHaveLength(1);
    expect(s.lostBoxes[0]).toMatchObject({ x: at?.x, y: at?.y, orderId: 'flaskBox' });
    expect(mails(s, 'fail_lost_order')[0]?.body).toContain('To a building');
    const p = s.agents[PLAYER_ID];
    if (!p || !at) throw new Error('no player');
    p.x = at.x;
    p.y = at.y;
    p.path = [];
    run(s, 2);
    expect(s.lostBoxes).toHaveLength(0);
    expect(s.boxes).toHaveLength(1);
    expect(s.boxes[0]?.orderId).toBe('flaskBox');
  });

  it('sends Bodo in before the box, and he leaves again', () => {
    const s = lateGame(2);
    s.funds = 1000;
    step(s, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
    let seen = false;
    for (let i = 0; i < 330; i++) {
      step(s, []);
      if (Object.values(s.agents).some((a) => a.kind === 'courier')) seen = true;
    }
    expect(seen).toBe(true);
    run(s, 300);
    expect(Object.values(s.agents).some((a) => a.kind === 'courier')).toBe(false);
    expect(s.director.visits).toHaveLength(0);
  });
});

describe('fail_substitution', () => {
  it('delays the kits by 30 s and gives 2 clean flasks', () => {
    let hit: GameState | null = null;
    for (let seed = 1; seed < 600 && !hit; seed++) {
      const s = lateGame(seed);
      s.funds = 1000;
      s.stock.cleanFlasks = 0;
      step(s, [{ type: 'PlaceOrder', orderId: 'assayKitBox' }]);
      if (mails(s, 'fail_substitution').length > 0 && !s.orders[0]?.lost) hit = s;
    }
    if (!hit) throw new Error('no substitution');
    expect(hit.stock.cleanFlasks).toBe(FAILURES.substitution.freeFlasks);
    expect(hit.orders[0]?.ticksLeft).toBeGreaterThan(590);
    expect(mails(hit, 'fail_substitution')[0]?.body).toContain('500 boxes of pipette tips');
  });
});

describe('fail_door_open', () => {
  it('makes growing cultures take 15 s longer', () => {
    const s = lateGame(4);
    const inc = equip(s, 'incubator');
    s.cultures = [
      { id: 'c1', incubatorId: inc.id, growTicksLeft: 100, status: 'growing' },
      { id: 'c2', incubatorId: inc.id, growTicksLeft: 50, status: 'growing' },
      { id: 'c3', incubatorId: inc.id, growTicksLeft: 0, status: 'ready' },
    ];
    s.director.firedBeats.push('pi_quick_one');
    // fire the row directly
    const row = import('../../src/sim/systems/eventCore');
    return row.then(({ fireEvent }) => {
      fireEvent(s, 'fail_door_open', []);
      expect(s.cultures.map((c) => c.growTicksLeft)).toEqual([250, 200, 0]);
    });
  });

  it('needs 2 growing cultures to be drawn', async () => {
    const { checkCondition } = await import('../../src/sim/systems/eventCore');
    const { EVENTS } = await import('../../src/content/events');
    const s = lateGame();
    const inc = equip(s, 'incubator');
    s.cultures = [{ id: 'c1', incubatorId: inc.id, growTicksLeft: 100, status: 'growing' }];
    const need = EVENTS['fail_door_open']?.needs?.[0];
    expect(need && checkCondition(s, need)).toBe(false);
    s.cultures.push({ id: 'c2', incubatorId: inc.id, growTicksLeft: 100, status: 'growing' });
    expect(need && checkCondition(s, need)).toBe(true);
  });
});

describe('fail_update', () => {
  it('takes one bench out of use for 20 s', async () => {
    const { fireEvent } = await import('../../src/sim/systems/eventCore');
    const s = lateGame(4);
    fireEvent(s, 'fail_update', []);
    const bench = equip(s, 'bench');
    expect(bench.outTicks).toBe(200);
    s.cultures = [{ id: 'c', incubatorId: equip(s, 'incubator').id, growTicksLeft: 0, status: 'ready' }];
    stand(s, 'bench');
    const bad = rejections(step(s, [{ type: 'Interact', jobId: 'runExperiment' }]));
    expect(bad[0]).toMatch(/installing updates/);
    run(s, 205);
    expect(bench.outTicks).toBe(0);
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'runExperiment' }]))).toEqual([]);
  });
});

describe('fail_bin_full', () => {
  it('sends one email when a bin fills up, and pauses experiments in that room', () => {
    const s = lateGame(2);
    markFired(s);
    s.flags['fridgeWarmDay'] = 1;
    setClock(s, 1, 9);
    const plot = s.plots['a'];
    if (!plot) throw new Error('no plot');
    plot.waste = 8;
    run(s, 12);
    expect(mails(s, 'fail_bin_full')).toHaveLength(1);
    run(s, 50);
    expect(mails(s, 'fail_bin_full')).toHaveLength(1);
    s.cultures = [{ id: 'c', incubatorId: equip(s, 'incubator').id, growTicksLeft: 0, status: 'ready' }];
    stand(s, 'bench');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'runExperiment' }]))[0]).toMatch(/bin is full/);
  });

  it('stays quiet in the first 6 minutes', () => {
    const s = newGame(2);
    markFired(s);
    s.flags['fridgeWarmDay'] = 1;
    const plot = s.plots['a'];
    if (plot) plot.waste = 8;
    run(s, 20);
    expect(mails(s, 'fail_bin_full')).toHaveLength(0);
  });
});

describe('director unit', () => {
  it('can be run on its own without other systems', () => {
    const s = newGame();
    directorSystem(s, []);
    expect(s.inbox).toHaveLength(1);
  });
});
