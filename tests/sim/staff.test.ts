import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../../src/content/balance';
import { ENERGY, MOOD, PAYROLL, ROLES, TRAIT_ORDER, TRAIT_TUNING, type StaffRole, type TraitId } from '../../src/content/staff';
import { ENTRANCE } from '../../src/content/map';
import { PLAYER_ID } from '../../src/sim/commands';
import { frontTiles } from '../../src/sim/grid';
import { pathWarnings } from '../../src/sim/placement';
import { staffRows, hireOptions } from '../../src/sim/selectors';
import { serialize } from '../../src/sim/save';
import { step } from '../../src/sim/step';
import { contaminationChance } from '../../src/sim/systems/cultures';
import { completeJob } from '../../src/sim/systems/jobs';
import {
  computeMood,
  hireBlocker,
  isOnBreak,
  makeCandidates,
  moodSpeed,
  needsSystem,
  staffAiSystem,
  workRate,
} from '../../src/sim/systems/staff';
import type { Agent, Equipment, GameState } from '../../src/sim/types';
import { equip, newGame, rejections, run, stand } from './helpers';

/** Hires a candidate of the role, with the trait you want, and returns their agent. */
function hire(s: GameState, role: StaffRole, trait: TraitId = 'tidy'): Agent {
  const cand = s.candidates.find((c) => c.role === role && !Object.values(s.agents).some((a) => a.staff?.name === c.name));
  if (!cand) throw new Error(`no ${role} candidate`);
  cand.trait = trait;
  const ev = step(s, [{ type: 'HireStaff', candidateId: cand.id }]);
  const agent = Object.values(s.agents).find((a) => a.staff?.name === cand.name);
  if (!agent) throw new Error(`not hired: ${rejections(ev).join(', ')}`);
  return agent;
}

function richGame(seed = 1): GameState {
  const s = newGame(seed);
  s.funds = 5000;
  s.reputation = 10;
  s.flags['fridgeWarmDay'] = 1; // keep the warm fridge out of the way
  return s;
}

function buy(s: GameState, plotId: string, room: 'washup' | 'break'): void {
  step(s, [{ type: 'BuyPlot', plotId, roomType: room }]);
}

function put(s: GameState, defId: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): Equipment {
  const eq: Equipment = { id: `t${s.nextId++}`, defId, tier: 1, x, y, rot, broken: false, cycle: null };
  s.equipment[eq.id] = eq;
  s.gridVersion += 1;
  return eq;
}

/** Puts the agent on the first front tile of a station, facing it, as if they had arrived. */
function place(s: GameState, a: Agent, eq: Equipment): void {
  const t = frontTiles(eq)[0] as { x: number; y: number };
  a.x = t.x;
  a.y = t.y;
  a.path = [];
  a.facing = ({ 0: 'up', 1: 'right', 2: 'down', 3: 'left' } as const)[eq.rot];
  void s;
}

function readyCulture(s: GameState): void {
  s.cultures.push({ id: `c${s.nextId++}`, incubatorId: equip(s, 'incubator').id, growTicksLeft: 0, status: 'ready' });
}

const jobOf = (s: GameState, a: Agent): string | undefined => (a.jobId ? s.jobs[a.jobId]?.defId : undefined);

/** Lets the staff think now, whatever tick it is. */
function think(s: GameState): void {
  s.tick = 0;
  staffAiSystem(s);
}

describe('hiring', () => {
  it('shows 3 candidates per role, each with a name, a colour and a trait', () => {
    const s = newGame();
    for (const role of ['technician', 'washup', 'cleaner'] as const) {
      const list = s.candidates.filter((c) => c.role === role);
      expect(list).toHaveLength(3);
      for (const c of list) {
        expect(c.name.length).toBeGreaterThan(0);
        expect(TRAIT_ORDER).toContain(c.trait);
        expect(c.colour).toBeTruthy();
      }
    }
    expect(new Set(s.candidates.map((c) => c.name)).size).toBe(9);
    expect(hireOptions(s).map((r) => r.candidates.length)).toEqual([3, 3, 3]);
  });

  it('draws the same candidates for the same seed and day, and new ones each morning', () => {
    expect(newGame(7).candidates).toEqual(newGame(7).candidates);
    const s = newGame(7);
    const before = JSON.stringify(s.candidates);
    run(s, TICKS_PER_DAY);
    expect(s.clock.day).toBe(2);
    expect(JSON.stringify(s.candidates)).not.toBe(before);
    expect(s.candidates).toHaveLength(9);
    expect(makeCandidates(s)).toEqual(s.candidates);
  });

  it('keeps the technician locked until Reputation 10 and says why', () => {
    const s = newGame();
    s.funds = 1000;
    s.reputation = 9;
    const cand = s.candidates.find((c) => c.role === 'technician');
    const ev = step(s, [{ type: 'HireStaff', candidateId: cand?.id ?? '' }]);
    expect(rejections(ev)).toEqual(['Needs Reputation 10']);
    expect(hireOptions(s)[0]?.locked).toBe('Needs Reputation 10');
    expect(Object.keys(s.agents)).toEqual([PLAYER_ID]);
    expect(s.funds).toBe(1000);
    s.reputation = 10;
    expect(hireOptions(s)[0]?.locked).toBeNull();
  });

  it('keeps wash-up crew for owners of a Wash-up Room and cleaners for owners of 2 rooms', () => {
    const s = richGame();
    expect(hireBlocker(s, 'washup')).toBe('Needs a Wash-up Room');
    expect(hireBlocker(s, 'cleaner')).toBe('Needs 2 rooms');
    buy(s, 'b', 'washup');
    expect(hireBlocker(s, 'washup')).toBeNull();
    expect(hireBlocker(s, 'cleaner')).toBeNull();
  });

  it('charges the fee, removes the candidate and walks the hire in from the entrance', () => {
    const s = richGame();
    const cand = s.candidates.find((c) => c.role === 'technician');
    const a = hire(s, 'technician');
    expect(s.funds).toBe(5000 - ROLES.technician.fee);
    expect(s.candidates.find((c) => c.id === cand?.id)).toBeUndefined();
    expect(s.candidates).toHaveLength(8);
    expect(a.kind).toBe('technician');
    expect(a.staff).toMatchObject({ role: 'technician', salary: 60, energy: 100 });
    expect({ x: a.x, y: a.y }).toEqual({ x: ENTRANCE.x, y: ENTRANCE.y });
    expect(staffRows(s)).toHaveLength(1);
  });

  it('allows at most 2 of each role', () => {
    const s = richGame();
    hire(s, 'technician');
    hire(s, 'technician');
    const third = s.candidates.find((c) => c.role === 'technician');
    expect(rejections(step(s, [{ type: 'HireStaff', candidateId: third?.id ?? '' }]))).toEqual(['You already have 2']);
  });

  it('cannot hire while Funds are negative or too low', () => {
    const s = richGame();
    s.funds = 199;
    const cand = s.candidates.find((c) => c.role === 'technician')?.id ?? '';
    expect(rejections(step(s, [{ type: 'HireStaff', candidateId: cand }]))).toEqual(['Needs 200 Funds']);
    s.funds = -10;
    expect(rejections(step(s, [{ type: 'HireStaff', candidateId: cand }]))[0]).toMatch(/negative/);
  });

  it('refuses a candidate who is not there', () => {
    const s = richGame();
    expect(rejections(step(s, [{ type: 'HireStaff', candidateId: 'nobody' }]))).toEqual(['That person has gone home']);
  });
});

describe('role priorities', () => {
  it('the technician bins a contaminated culture before running an experiment, and splits last of the lab jobs', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    s.cultures.push({ id: 'cx', incubatorId: equip(s, 'incubator').id, growTicksLeft: 0, status: 'contaminated' });
    think(s);
    expect(jobOf(s, t)).toBe('binCulture');
  });

  it('the technician runs experiments before splitting cells', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    think(s);
    expect(jobOf(s, t)).toBe('runExperiment');
  });

  it('the technician splits cells when nothing else is available, then makes media, then puts away orders', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    think(s);
    expect(jobOf(s, t)).toBe('splitCells');
    s.jobs = {};
    t.jobId = null;
    s.stock.cleanFlasks = 0;
    s.stock.media = 0;
    think(s);
    expect(jobOf(s, t)).toBe('makeMedia');
    s.jobs = {};
    t.jobId = null;
    s.stock.mediaPowder = 0;
    s.boxes.push({ id: 'b1', orderId: 'flaskBox', qty: 6 });
    think(s);
    expect(jobOf(s, t)).toBe('putAwayOrder');
  });

  it('the wash-up crew starts the autoclave when flasks have piled up, and washes at the sink otherwise', () => {
    const s = richGame();
    buy(s, 'b', 'washup');
    put(s, 'autoclave', 12, 3, 0);
    const w = hire(s, 'washup');
    s.stock.dirtyFlasks = 5;
    think(s);
    expect(jobOf(s, w)).toBe('loadAutoclave');
    s.jobs = {};
    w.jobId = null;
    s.stock.dirtyFlasks = 2;
    think(s);
    expect(jobOf(s, w)).toBe('washFlask');
  });

  it('the cleaner takes out a half-full bin first and tidies a dirty room otherwise', () => {
    const s = richGame();
    buy(s, 'b', 'washup');
    const c = hire(s, 'cleaner');
    s.plots['a']!.cleanliness = 50;
    s.plots['a']!.waste = 1;
    think(s);
    expect(jobOf(s, c)).toBe('tidyUp');
    s.jobs = {};
    c.jobId = null;
    s.plots['a']!.waste = 4;
    think(s);
    expect(jobOf(s, c)).toBe('takeOutWaste');
  });

  it('staff of one role do not do the other roles\' jobs', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    s.stock.dirtyFlasks = 6;
    s.plots['a']!.waste = 8;
    s.stock.cleanFlasks = 0;
    s.stock.media = 0;
    s.stock.mediaPowder = 0;
    think(s);
    expect(jobOf(s, t)).toBeUndefined();
  });
});

describe('working unattended', () => {
  it('a hired technician walks in, then splits cells and runs experiments without being told', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    s.stock.cleanFlasks = 6;
    s.stock.media = 6;
    s.stock.assayKits = 6;
    run(s, 40);
    expect(t.x).toBeGreaterThan(ENTRANCE.x); // already on the way in
    run(s, 1500);
    expect(s.stats.splits).toBeGreaterThan(0);
    expect(s.stats.experiments).toBeGreaterThan(0);
    expect(s.data).toBeGreaterThan(0);
  });

  it('wash-up crew wash flasks and run the autoclave', () => {
    const s = richGame();
    buy(s, 'b', 'washup');
    put(s, 'autoclave', 12, 3, 0);
    hire(s, 'washup');
    s.stock.dirtyFlasks = 6;
    s.stock.cleanFlasks = 0;
    run(s, 1500);
    expect(s.stats.autoclaveCycles).toBeGreaterThan(0);
    expect(s.stock.dirtyFlasks).toBe(0);
    expect(s.stock.cleanFlasks).toBe(6);
  });

  it('a cleaner empties bins and tidies rooms', () => {
    const s = richGame();
    buy(s, 'b', 'washup');
    hire(s, 'cleaner');
    s.plots['a']!.waste = 8;
    s.plots['a']!.cleanliness = 40;
    run(s, 1200);
    expect(s.plots['a']?.waste).toBe(0);
    expect(s.plots['a']?.cleanliness).toBeGreaterThanOrEqual(80);
  });

  it('with the player standing still, Data keeps rising and no bin stays full', () => {
    const s = richGame();
    s.funds = 5000;
    buy(s, 'b', 'washup');
    put(s, 'autoclave', 12, 3, 0);
    hire(s, 'technician');
    hire(s, 'washup');
    hire(s, 'cleaner');
    s.stock.cleanFlasks = 6;
    s.stock.media = 6;
    s.stock.assayKits = 24;
    s.stock.mediaPowder = 6;
    let maxWaste = 0;
    for (let i = 0; i < 1800; i++) {
      step(s, []);
      maxWaste = Math.max(maxWaste, s.plots['a']?.waste ?? 0);
    }
    expect(s.stats.experiments).toBeGreaterThanOrEqual(3);
    expect(s.data).toBeGreaterThanOrEqual(30);
    expect(maxWaste).toBeLessThan(8);
    expect(s.plots['a']?.waste ?? 0).toBeLessThan(8);
  });
});

describe('reservations', () => {
  it('the player can take a station a staff member was walking to, and the staff member picks another job', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    s.stock.cleanFlasks = 6;
    s.stock.media = 6;
    readyCulture(s);
    think(s);
    expect(jobOf(s, t)).toBe('runExperiment');
    const bench = equip(s, 'bench');
    expect(s.jobs[t.jobId ?? '']?.stationId).toBe(bench.id);
    stand(s, 'bench');
    const ev = step(s, [{ type: 'Interact', jobId: 'runExperiment' }]);
    expect(rejections(ev)).toEqual([]);
    expect(s.agents[PLAYER_ID]?.jobId).not.toBeNull();
    expect(t.jobId).toBeNull();
    // The only ready culture is the player's now, so the technician splits cells instead.
    think(s);
    expect(jobOf(s, t)).toBe('splitCells');
  });

  it('refuses the player a station where a staff member is already working, with their name', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    const bench = equip(s, 'bench');
    place(s, t, bench);
    think(s);
    t.facing = 'up';
    step(s, []);
    expect(jobOf(s, t)).toBe('runExperiment');
    stand(s, 'bench');
    const ev = step(s, [{ type: 'Interact', jobId: 'runExperiment' }]);
    expect(rejections(ev)).toEqual([`${t.staff?.name} is using it`]);
  });

  it('two staff never take the same station or the same input', () => {
    const s = richGame();
    const a = hire(s, 'technician');
    const b = hire(s, 'technician');
    readyCulture(s); // one ready culture, two technicians
    think(s);
    const defs = [jobOf(s, a), jobOf(s, b)];
    expect(defs.filter((d) => d === 'runExperiment')).toHaveLength(1);
    const stations = [a, b].flatMap((x) => (x.jobId ? [s.jobs[x.jobId]?.stationId] : []));
    expect(new Set(stations).size).toBe(stations.length);
  });

  it('the player cannot start a job whose only input is already taken by a staff member', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    think(s);
    expect(jobOf(s, t)).toBe('runExperiment');
    // A second bench so the station is not what blocks the player.
    const bench2 = put(s, 'bench', 5, 5, 2);
    void bench2;
    const eq = s.equipment[Object.keys(s.equipment).find((k) => s.equipment[k]?.x === 5 && s.equipment[k]?.y === 5) ?? ''] as Equipment;
    const front = frontTiles(eq)[0] as { x: number; y: number };
    const p = s.agents[PLAYER_ID] as Agent;
    p.x = front.x;
    p.y = front.y;
    p.facing = 'down';
    const ev = step(s, [{ type: 'Interact', stationId: eq.id, jobId: 'runExperiment' }]);
    expect(rejections(ev)).toEqual(['Needs 1 ready culture']);
  });
});

describe('unreachable stations', () => {
  it('staff skip a station with no reachable front tile and pick another job', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    s.stock.cleanFlasks = 6;
    s.stock.media = 6;
    s.stock.assayKits = 6;
    const bench = equip(s, 'bench');
    // Wall off both front tiles of the bench.
    for (const f of frontTiles(bench)) put(s, 'plant', f.x, f.y);
    expect(pathWarnings(s).some((w) => w.equipmentId === bench.id)).toBe(true);
    think(s);
    expect(jobOf(s, t)).toBe('splitCells');
    // And they carry on without freezing.
    run(s, 800);
    expect(s.stats.splits).toBeGreaterThan(0);
  });

  it('staff with a job at a station that becomes unreachable drop it and carry on', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    s.stock.cleanFlasks = 6;
    s.stock.media = 6;
    think(s);
    expect(jobOf(s, t)).toBe('runExperiment');
    const bench = equip(s, 'bench');
    for (const f of frontTiles(bench)) put(s, 'plant', f.x, f.y);
    run(s, 400);
    expect(jobOf(s, t)).not.toBe('runExperiment');
    expect(s.stats.splits).toBeGreaterThan(0);
  });
});

describe('Energy and breaks', () => {
  /** A technician standing at the bench with a long job, so Energy can be watched. */
  function workingTech(trait: TraitId = 'tidy'): { s: GameState; t: Agent } {
    const s = richGame();
    const t = hire(s, 'technician', trait);
    s.stock.cleanFlasks = 99;
    s.stock.media = 99;
    s.stock.assayKits = 99;
    return { s, t };
  }

  it('loses 1 Energy for every 4 s of work', () => {
    const { s, t } = workingTech();
    const hood = equip(s, 'hood');
    place(s, t, hood);
    run(s, 5);
    const e0 = t.staff?.energy ?? 0;
    run(s, 40);
    expect((t.staff?.energy ?? 0)).toBe(e0 - 1);
    run(s, 80);
    expect((t.staff?.energy ?? 0)).toBe(e0 - 3);
  });

  it('Coffee Powered drains Energy 50% faster', () => {
    const base = workingTech();
    const fast = workingTech('coffeePowered');
    for (const w of [base, fast]) place(w.s, w.t, equip(w.s, 'hood'));
    run(base.s, 205);
    run(fast.s, 205);
    const lost = (w: { t: Agent }): number => 100 - (w.t.staff?.energy ?? 0);
    expect(lost(fast)).toBeGreaterThan(lost(base));
    expect(lost(fast) / lost(base)).toBeCloseTo(1.5, 0);
  });

  it('does not drain Energy while standing idle', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    s.stock.cleanFlasks = 0;
    s.stock.mediaPowder = 0;
    run(s, 600);
    expect(t.staff?.energy).toBe(100);
  });

  it('finishes the current job at 20 Energy, then takes a coffee break and comes back at 100', () => {
    const { s, t } = workingTech();
    put(s, 'coffee', 3, 3, 0);
    // The coffee machine must be in a room that allows it for the real game, but the sim does not care.
    const coffee = Object.values(s.equipment).find((e) => e.defId === 'coffee') as Equipment;
    t.staff!.energy = ENERGY.breakAt + 1;
    place(s, t, equip(s, 'hood'));
    let tookBreak = false;
    let finishedFirst = false;
    for (let i = 0; i < 1500; i++) {
      step(s, []);
      if (isOnBreak(s, t) && !tookBreak) {
        tookBreak = true;
        finishedFirst = s.stats.splits >= 1;
        expect(t.staff?.energy).toBeLessThanOrEqual(ENERGY.breakAt);
        expect(coffee).toBeDefined();
      }
      if (tookBreak && !isOnBreak(s, t) && (t.staff?.energy ?? 0) === 100) break;
    }
    expect(tookBreak).toBe(true);
    expect(finishedFirst).toBe(true);
    expect(t.staff?.energy).toBe(100);
    run(s, 300);
    expect(s.stats.splits + s.stats.experiments).toBeGreaterThan(1); // back at work
  });

  it('a break takes 20 s at a tier 1 coffee machine and 12 s at tier 2, 50% longer for Chatty', () => {
    const lengths: number[] = [];
    for (const [tier, trait] of [[1, 'tidy'], [2, 'tidy'], [1, 'chatty']] as const) {
      const { s, t } = workingTech(trait);
      const cof = put(s, 'coffee', 3, 3, 0);
      cof.tier = tier;
      t.staff!.energy = 10;
      place(s, t, cof);
      step(s, []);
      think(s);
      expect(jobOf(s, t)).toBe('coffeeBreak');
      lengths.push(s.jobs[t.jobId ?? '']?.totalTicks ?? 0);
    }
    expect(lengths).toEqual([200, 120, 300]);
  });

  it('with no coffee machine to reach, the break is 40 s sitting where they are', () => {
    const { s, t } = workingTech();
    t.staff!.energy = 10;
    think(s);
    expect(t.staff?.restTicks).toBe(400);
    expect(isOnBreak(s, t)).toBe(true);
    run(s, 399);
    expect(t.staff?.energy).toBe(10);
    run(s, 2);
    expect(t.staff?.energy).toBe(100);
    expect(isOnBreak(s, t)).toBe(false);
  });
});

describe('Mood', () => {
  const moodOf = (s: GameState, a: Agent): number => computeMood(s, a);

  it('is 60 at base, in the corridor with nothing built', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    expect(MOOD.base).toBe(60);
    // The entrance is not in a room: no room modifier. Bins are empty.
    expect(moodOf(s, t)).toBe(60);
  });

  it('adds +10 for a coffee machine, +10 for a sofa, +2 per plant up to 3', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    put(s, 'coffee', 3, 3);
    expect(moodOf(s, t)).toBe(70);
    put(s, 'sofa', 4, 3);
    expect(moodOf(s, t)).toBe(80);
    for (let i = 0; i < 5; i++) put(s, 'plant', 12 + i, 3);
    expect(moodOf(s, t)).toBe(86);
  });

  it('adds +10 in a clean room (70 or more) and takes 10 off in a dirty one (below 40)', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    t.x = 5;
    t.y = 5;
    s.plots['a']!.cleanliness = 70;
    expect(moodOf(s, t)).toBe(70);
    s.plots['a']!.cleanliness = 60;
    expect(moodOf(s, t)).toBe(60);
    s.plots['a']!.cleanliness = 39;
    expect(moodOf(s, t)).toBe(50);
  });

  it('takes 10 off while any waste bin is full, 5 off for a PI request, adds 20 after cake', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    s.plots['a']!.waste = 8;
    expect(moodOf(s, t)).toBe(50);
    s.plots['a']!.waste = 0;
    s.flags['piRequest'] = true;
    expect(moodOf(s, t)).toBe(55);
    s.flags['piRequest'] = false;
    s.flags['cakeTicks'] = 600;
    expect(moodOf(s, t)).toBe(80);
  });

  it('is recalculated every 10 s, and clamped to 0 to 100', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    for (let i = 0; i < 5; i++) put(s, 'plant', 12 + i, 3);
    put(s, 'coffee', 3, 3);
    put(s, 'sofa', 4, 3);
    s.flags['cakeTicks'] = 600;
    t.x = 5;
    t.y = 5; // clean room
    expect(moodOf(s, t)).toBe(100);
    s.tick = 5;
    needsSystem(s);
    expect(t.staff?.mood).not.toBe(100); // not a multiple of 100 ticks: not recalculated yet
    s.tick = 100;
    needsSystem(s);
    expect(t.staff?.mood).toBe(100);
  });

  it('multiplies job speed by 0.9 at Mood 0 and 1.1 at Mood 100, linear between', () => {
    expect(moodSpeed(0)).toBeCloseTo(0.9);
    expect(moodSpeed(100)).toBeCloseTo(1.1);
    expect(moodSpeed(50)).toBeCloseTo(1.0);
    const s = richGame();
    const t = hire(s, 'technician');
    t.staff!.mood = 100;
    const hi = workRate(s, t, 'splitCells');
    t.staff!.mood = 0;
    const lo = workRate(s, t, 'splitCells');
    expect(hi / lo).toBeCloseTo(1.1 / 0.9);
    expect(hi).toBeCloseTo(0.8 * 1.1);
  });
});

describe('traits', () => {
  it('has all 8 traits and each one draws', () => {
    expect(TRAIT_ORDER).toHaveLength(8);
    const seen = new Set<TraitId>();
    for (let seed = 1; seed < 40; seed++) for (const c of newGame(seed).candidates) seen.add(c.trait);
    expect(seen.size).toBe(8);
  });

  it('Golden Hands: cultures they split carry half the contamination chance', () => {
    const s = richGame();
    const inc = equip(s, 'incubator');
    expect(contaminationChance(s, inc, true)).toBeCloseTo(contaminationChance(s, inc, false) * TRAIT_TUNING.goldenContamination);
    const g = hire(s, 'technician', 'goldenHands');
    const hood = equip(s, 'hood');
    place(s, g, hood);
    step(s, []);
    think(s);
    run(s, 1300);
    expect(s.cultures.length).toBeGreaterThan(0);
    expect(s.cultures.every((c) => c.golden === true)).toBe(true);
    // Someone else's cultures are not golden.
    const s2 = richGame();
    const o = hire(s2, 'technician', 'tidy');
    place(s2, o, equip(s2, 'hood'));
    run(s2, 600);
    expect(s2.cultures.some((c) => c.golden)).toBe(false);
  });

  it('Labels Everything: puts away orders 30% faster', () => {
    const s = richGame();
    const plain = hire(s, 'technician', 'tidy');
    const labels = hire(s, 'technician', 'labelsEverything');
    expect(workRate(s, labels, 'putAwayOrder') / workRate(s, plain, 'putAwayOrder')).toBeCloseTo(1.3);
    expect(workRate(s, labels, 'splitCells')).toBeCloseTo(workRate(s, plain, 'splitCells'));
  });

  it('Coffee Powered: works 15% faster', () => {
    const s = richGame();
    const plain = hire(s, 'technician', 'tidy');
    const fast = hire(s, 'technician', 'coffeePowered');
    expect(workRate(s, fast, 'splitCells') / workRate(s, plain, 'splitCells')).toBeCloseTo(1.15);
  });

  it('Early Bird: 15% faster before 12:00 and 5% slower after', () => {
    const s = richGame();
    const plain = hire(s, 'technician', 'tidy');
    const bird = hire(s, 'technician', 'earlyBird');
    s.clock.tickOfDay = 959;
    expect(workRate(s, bird, 'splitCells') / workRate(s, plain, 'splitCells')).toBeCloseTo(1.15);
    s.clock.tickOfDay = 960;
    expect(workRate(s, bird, 'splitCells') / workRate(s, plain, 'splitCells')).toBeCloseTo(0.95);
  });

  it('Hums While Pipetting: others in the same room get +5 Mood, nobody elsewhere does', () => {
    const s = richGame();
    const hummer = hire(s, 'technician', 'humsWhilePipetting');
    const other = hire(s, 'technician', 'tidy');
    for (const a of [hummer, other]) {
      a.x = 5;
      a.y = 5;
    }
    expect(computeMood(s, other)).toBe(70 + 5); // clean room +10, hum +5
    expect(computeMood(s, hummer)).toBe(70); // not for themselves
    other.x = ENTRANCE.x;
    other.y = ENTRANCE.y;
    expect(computeMood(s, other)).toBe(60);
  });

  it('Tidy: their jobs do not reduce Cleanliness', () => {
    const s = richGame();
    const t = hire(s, 'technician', 'tidy');
    const hood = equip(s, 'hood');
    place(s, t, hood);
    run(s, 1300);
    expect(s.stats.splits).toBeGreaterThan(0);
    expect(s.plots['a']?.cleanliness).toBe(100);
    const s2 = richGame();
    const u = hire(s2, 'technician', 'goldenHands');
    place(s2, u, equip(s2, 'hood'));
    run(s2, 1300);
    expect(s2.plots['a']?.cleanliness).toBeLessThan(100);
  });

  it('Chatty: everyone else gets +5 Mood while they are on break', () => {
    const s = richGame();
    const chatty = hire(s, 'technician', 'chatty');
    const other = hire(s, 'technician', 'tidy');
    expect(computeMood(s, other)).toBe(60);
    chatty.staff!.restTicks = 100;
    expect(computeMood(s, other)).toBe(65);
    expect(computeMood(s, chatty)).toBe(60);
  });

  it('Has Seen Things: ignores all Mood penalties but keeps the bonuses', () => {
    const s = richGame();
    const vet = hire(s, 'technician', 'hasSeenThings');
    const other = hire(s, 'technician', 'tidy');
    for (const a of [vet, other]) {
      a.x = 5;
      a.y = 5;
    }
    s.plots['a']!.cleanliness = 10;
    s.plots['a']!.waste = 8;
    s.flags['piRequest'] = true;
    expect(computeMood(s, other)).toBe(60 - 10 - 10 - 5);
    expect(computeMood(s, vet)).toBe(60);
    put(s, 'coffee', 3, 3);
    expect(computeMood(s, vet)).toBe(70);
  });
});

describe('salaries and negative funds', () => {
  it('pays salaries after core funding at the end of the day and lists them on the card event', () => {
    const s = richGame();
    s.funds = 1000;
    s.stock.cleanFlasks = 0;
    s.stock.mediaPowder = 0; // keep staff out of the way
    const t = hire(s, 'technician');
    const names = t.staff?.name;
    s.funds = 1000;
    const ev = run(s, TICKS_PER_DAY);
    const eod = ev.find((e) => e.type === 'EndOfDay');
    expect(eod).toMatchObject({ type: 'EndOfDay', funding: 100, salaryTotal: 60, covered: false, funds: 1040 });
    expect(eod && 'salaries' in eod ? eod.salaries : []).toEqual([{ name: names, role: 'Technician', amount: 60 }]);
    expect(s.funds).toBe(1040);
  });

  it('lets Funds go negative, down to -500, and the card says so; nobody leaves', () => {
    const s = richGame();
    const a = hire(s, 'technician');
    const b = hire(s, 'technician');
    s.funds = -20;
    const ev = run(s, TICKS_PER_DAY);
    const eod = ev.find((e) => e.type === 'EndOfDay');
    expect(eod).toMatchObject({ salaryTotal: 120, covered: true });
    expect(s.funds).toBe(-20 + 100 - 120);
    expect(s.agents[a.id]).toBeDefined();
    expect(s.agents[b.id]).toBeDefined();
    s.funds = -490;
    run(s, TICKS_PER_DAY);
    expect(s.funds).toBe(PAYROLL.floor);
    expect(PAYROLL.coveredText).toContain('discretionary account');
  });

  it('rooms and equipment cannot be bought while Funds are negative, but orders still work', () => {
    const s = richGame();
    s.funds = -50;
    expect(rejections(step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }]))[0]).toMatch(/negative/);
    expect(rejections(step(s, [{ type: 'PlaceEquipment', defId: 'desk', x: 4, y: 4, rot: 0 }]))[0]).toMatch(/negative/);
    expect(s.plots['b']?.owned).toBe(false);
    expect(rejections(step(s, [{ type: 'PlaceOrder', orderId: 'assayKitBox' }]))).toEqual([]);
    expect(s.funds).toBe(-90);
    expect(s.orders).toHaveLength(1);
  });

  it('stops orders at the -500 floor', () => {
    const s = richGame();
    s.funds = -470;
    expect(rejections(step(s, [{ type: 'PlaceOrder', orderId: 'assayKitBox' }]))[0]).toMatch(/limit/);
    expect(s.funds).toBe(-470);
  });

  it('still refuses an order the player cannot afford while Funds are positive', () => {
    const s = richGame();
    s.funds = 39;
    expect(rejections(step(s, [{ type: 'PlaceOrder', orderId: 'assayKitBox' }]))).toEqual(['Needs 40 Funds']);
  });
});

describe('part ways', () => {
  it('removes the person, frees their station and stops their salary', () => {
    const s = richGame();
    const t = hire(s, 'technician');
    readyCulture(s);
    think(s);
    expect(t.jobId).not.toBeNull();
    const jobId = t.jobId ?? '';
    const ev = step(s, [{ type: 'PartWays', agentId: t.id }]);
    expect(s.agents[t.id]).toBeUndefined();
    expect(s.jobs[jobId]).toBeUndefined();
    expect(ev.some((e) => e.type === 'StaffLeft')).toBe(true);
    expect(staffRows(s)).toHaveLength(0);
    s.funds = 1000;
    const eod = run(s, TICKS_PER_DAY).find((e) => e.type === 'EndOfDay');
    expect(eod).toMatchObject({ salaryTotal: 0 });
    // The name goes back into the pool for the next morning's candidates.
    expect(s.candidates).toHaveLength(9);
  });

  it('refuses when there is nobody to part ways with, and never removes the player', () => {
    const s = richGame();
    expect(rejections(step(s, [{ type: 'PartWays', agentId: PLAYER_ID }]))).toEqual(['Nobody to part ways with']);
    expect(s.agents[PLAYER_ID]).toBeDefined();
  });
});

describe('determinism with staff', () => {
  it('gives the same state for the same seed and commands', () => {
    const make = (): GameState => {
      const s = richGame(3);
      buy(s, 'b', 'washup');
      hire(s, 'technician', 'goldenHands');
      hire(s, 'washup');
      hire(s, 'cleaner', 'chatty');
      s.stock.assayKits = 20;
      return s;
    };
    const a = make();
    const b = make();
    run(a, 5000);
    run(b, 5000);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.stats.experiments).toBeGreaterThan(0);
  });

  it('completeJob is only used with a real job (guard for the export)', () => {
    expect(typeof completeJob).toBe('function');
  });
});
