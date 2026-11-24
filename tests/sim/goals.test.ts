import { describe, expect, it } from 'vitest';
import { GOALS } from '../../src/content/facility';
import { PROMPTS } from '../../src/content/facility';
import { PLOTS } from '../../src/content/map';
import { SCHEMA_VERSION } from '../../src/content/balance';
import { placementBlocker } from '../../src/sim/placement';
import { goalProgress, goalRows } from '../../src/sim/selectors';
import { deserialize, restoreState, serialize } from '../../src/sim/save';
import { step } from '../../src/sim/step';
import { goalValue } from '../../src/sim/systems/goals';
import type { SimEvent } from '../../src/sim/simEvents';
import type { GameState, Rot } from '../../src/sim/types';
import { markFired, newGame, run, setClock } from './helpers';

function rich(): GameState {
  const s = newGame(3);
  s.funds = 9000;
  s.reputation = 30;
  for (const e of Object.values(s.equipment)) if (e.defId === 'fridge') e.broken = false;
  markFired(s);
  return s;
}

function hire(s: GameState, role: string): void {
  const cand = s.candidates.find((c) => c.role === role);
  step(s, [{ type: 'HireStaff', candidateId: cand?.id ?? '' }]);
}

function openMedia(s: GameState, plotId: string): SimEvent[] {
  const out: SimEvent[] = [];
  out.push(...step(s, [{ type: 'BuyPlot', plotId, roomType: 'media' }]));
  const p = PLOTS.find((q) => q.id === plotId);
  for (let y = (p?.y ?? 0); y < (p?.y ?? 0) + (p?.h ?? 0); y++)
    for (let x = p?.x ?? 0; x < (p?.x ?? 0) + (p?.w ?? 0); x++)
      for (const rot of [0, 1, 2, 3] as Rot[])
        if (placementBlocker(s, 'mediaprep', x, y, rot) === null) {
          out.push(...step(s, [{ type: 'PlaceEquipment', defId: 'mediaprep', x, y, rot }]));
          return out;
        }
  return out;
}

const reached = (s: GameState, id: string): number | undefined => s.goals.reached[id];

describe('the Lab Warming list', () => {
  it('has the five goals of design doc 2.4, none ticked at the start', () => {
    const s = newGame();
    expect(GOALS.map((g) => g.text)).toEqual([
      'Own 4 rooms',
      'Hire 2 different kinds of staff',
      'Open 1 facility',
      'Get through 1 request from Prof. Quince',
      'Get 1 grant in before its deadline',
    ]);
    run(s, 20);
    expect(goalProgress(s)).toEqual({ done: 0, total: 5 });
    expect(goalRows(s).map((r) => [r.id, r.have, r.need])).toEqual([
      ['rooms', 1, 4],
      ['staff', 0, 2],
      ['facility', 0, 1],
      ['request', 0, 1],
      ['grant', 0, 1],
    ]);
  });

  it('ticks "own 4 rooms" on the tick the fourth room is bought, and the starting Lab counts', () => {
    const s = rich();
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }, { type: 'BuyPlot', plotId: 'c', roomType: 'break' }]);
    run(s, 2);
    expect(goalValue(s, 'rooms')).toBe(3);
    expect(reached(s, 'rooms')).toBeUndefined();
    const at = s.tick;
    step(s, [{ type: 'BuyPlot', plotId: 'd', roomType: 'office' }]);
    expect(reached(s, 'rooms')).toBe(at + 1);
  });

  it('ticks "2 different kinds of staff" for two roles, not two people of one role', () => {
    const s = rich();
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }]);
    hire(s, 'technician');
    hire(s, 'technician');
    run(s, 2);
    expect(goalValue(s, 'staff')).toBe(1);
    expect(reached(s, 'staff')).toBeUndefined();
    hire(s, 'washup');
    expect(reached(s, 'staff')).toBeDefined();
  });

  it('ticks "open 1 facility" when the prep unit is in, not when only the room is bought', () => {
    const s = rich();
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'media' }]);
    run(s, 2);
    expect(reached(s, 'facility')).toBeUndefined();
    openMedia(s, 'b');
    run(s, 2);
    expect(reached(s, 'facility')).toBeDefined();
  });

  it('ticks "a request from Prof. Quince" when a request is done, and not when it is missed', () => {
    const s = rich();
    s.stats.requestsMissed = 1;
    run(s, 2);
    expect(reached(s, 'request')).toBeUndefined();
    s.stats.requestsDone = 1;
    run(s, 2);
    expect(reached(s, 'request')).toBeDefined();
  });

  it('ticks "a grant in before its deadline" for the Equipment Call, not for the Seedling Grant', () => {
    const s = rich();
    s.grants['seedling'] = { status: 'applied', decisionTicksLeft: 300 };
    run(s, 2);
    expect(reached(s, 'grant')).toBeUndefined();
    s.grantCalls['equipment'] = { announced: true, deadlineDay: 5, payPercent: 100, crashes: 0 };
    s.grants['equipment'] = { status: 'applied', decisionTicksLeft: 300 };
    run(s, 2);
    expect(reached(s, 'grant')).toBeDefined();
  });

  it('counts an application made during an extended deadline', () => {
    const s = rich();
    s.stats.requestsDone = 0;
    markFired(s);
    s.grantCalls['equipment'] = { announced: true, deadlineDay: 5, payPercent: 100, crashes: 0 };
    setClock(s, 5, 17, 3);
    run(s, 10); // the deadline passes: the portal crashes and the deadline moves to Day 6
    expect(s.grantCalls['equipment']?.crashes).toBe(1);
    expect(s.grantCalls['equipment']?.deadlineDay).toBe(6);
    s.grants['equipment'] = { status: 'applied', decisionTicksLeft: 300 };
    run(s, 2);
    expect(reached(s, 'grant')).toBeDefined();
  });

  it('keeps a goal ticked after it is reached, and records the play time', () => {
    const s = rich();
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }]);
    hire(s, 'washup');
    hire(s, 'technician');
    run(s, 5);
    const t = reached(s, 'staff') as number;
    expect(t).toBeGreaterThan(0);
    const wash = Object.values(s.agents).find((a) => a.staff?.role === 'washup');
    step(s, [{ type: 'PartWays', agentId: wash?.id ?? '' }]);
    run(s, 50);
    expect(reached(s, 'staff')).toBe(t);
    expect(goalRows(s).find((r) => r.id === 'staff')).toMatchObject({ done: true, have: 2, atSec: Math.round(t / 10) });
  });
});

describe('the Lab Warming Party', () => {
  /** Everything done except the last goal. */
  function almost(): GameState {
    const s = rich();
    s.stats.requestsDone = 1;
    s.grantCalls['equipment'] = { announced: true, deadlineDay: 5, payPercent: 100, crashes: 0 };
    s.grants['equipment'] = { status: 'applied', decisionTicksLeft: 100000 };
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }, { type: 'BuyPlot', plotId: 'c', roomType: 'break' }]);
    hire(s, 'washup');
    hire(s, 'technician');
    run(s, 5);
    return s;
  }

  it('plays once, when the fifth goal ticks, and the game carries on', () => {
    const s = almost();
    expect(s.goals.partyDone).toBe(false);
    const events = [...run(s, 3)];
    expect(events.some((e) => e.type === 'PartyStarted')).toBe(false);
    events.push(...step(s, [{ type: 'BuyPlot', plotId: 'd', roomType: 'media' }]));
    events.push(...run(s, 2));
    // the facility is not open yet: the room alone does not tick it
    expect(events.some((e) => e.type === 'PartyStarted')).toBe(false);
    events.length = 0;
    events.push(...openMedia(s, 'e'), ...run(s, 20));
    expect(events.filter((e) => e.type === 'PartyStarted')).toHaveLength(1);
    expect(s.goals.partyDone).toBe(true);
    expect(s.inbox.filter((m) => m.kind === 'lab_party')).toHaveLength(1);
    expect(s.director.visits.some((v) => v.kind === 'cake')).toBe(true);
    // days go by and nothing plays again
    const more = run(s, 6000);
    expect(more.filter((e) => e.type === 'PartyStarted')).toHaveLength(0);
    expect(s.inbox.filter((m) => m.kind === 'lab_party')).toHaveLength(1);
    expect(s.clock.speed).toBe(1);
  });

  it('does not play again after saving and loading', () => {
    const s = almost();
    openMedia(s, 'e');
    run(s, 20);
    expect(s.goals.partyDone).toBe(true);
    const back = deserialize(serialize(s));
    const events = run(back, 400);
    expect(events.filter((e) => e.type === 'PartyStarted')).toHaveLength(0);
    expect(back.inbox.filter((m) => m.kind === 'lab_party')).toHaveLength(1);
  });

  it('asks for feedback once when the party starts, then once more at 30 minutes, and never again', () => {
    const s = almost();
    const events = [...openMedia(s, 'e'), ...run(s, 20)];
    expect(events.filter((e) => e.type === 'FeedbackPrompt')).toEqual([{ type: 'FeedbackPrompt', reason: 'party' }]);
    s.tick = PROMPTS.thirtyMinSec * 10 - 3;
    const later = run(s, 10);
    expect(later.filter((e) => e.type === 'FeedbackPrompt')).toEqual([{ type: 'FeedbackPrompt', reason: 'thirty' }]);
    const again = run(s, 3000);
    expect(again.filter((e) => e.type === 'FeedbackPrompt')).toHaveLength(0);
    expect([...s.goals.prompted].sort()).toEqual(['party', 'thirty']);
  });

  it('sends the 30 minute prompt even if the goals were never reached', () => {
    const s = newGame();
    s.tick = PROMPTS.thirtyMinSec * 10 - 2;
    const events = run(s, 5);
    expect(events.filter((e) => e.type === 'FeedbackPrompt')).toEqual([{ type: 'FeedbackPrompt', reason: 'thirty' }]);
    expect(s.goals.partyDone).toBe(false);
  });
});

describe('migration from version 4 (milestone 6 saves)', () => {
  /** What a milestone 6 save looks like: schema 4, no facility, no goals, no new counters. */
  function m6Save(): Record<string, unknown> {
    const s = newGame(21);
    s.reputation = 12;
    s.funds = 900;
    s.stats.requestsDone = 1;
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }]);
    hire(s, 'washup');
    run(s, 50);
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    raw['schemaVersion'] = 4;
    delete raw['facility'];
    delete raw['goals'];
    const stats = raw['stats'] as Record<string, unknown>;
    for (const k of ['hires', 'prepBottles', 'mediaSold', 'visitorsServed']) delete stats[k];
    return raw;
  }

  it('is rejected by validation before migrating and accepted after, with the new fields', () => {
    const raw = m6Save();
    expect(() => deserialize(JSON.stringify({ ...raw, schemaVersion: SCHEMA_VERSION }))).toThrow(/facility|goals/);
    const loaded = restoreState(m6Save(), 4);
    expect(loaded.schemaVersion).toBe(5);
    expect(loaded.facility).toMatchObject({ target: 8, batchLeft: 0, visitorTicks: -1, earned: 0 });
    expect(loaded.goals).toEqual({ reached: {}, partyDone: false, prompted: [] });
    expect(loaded.stats).toMatchObject({ hires: 1, prepBottles: 0, mediaSold: 0, visitorsServed: 0 });
  });

  it('ticks the goals the old save already met on the next tick, and plays on to a save at version 5', () => {
    const loaded = deserialize(JSON.stringify(m6Save()));
    run(loaded, 3);
    expect(loaded.goals.reached['request']).toBeDefined();
    expect(loaded.goals.reached['facility']).toBeUndefined();
    expect(loaded.goals.partyDone).toBe(false);
    const again = deserialize(serialize(loaded));
    expect(again).toEqual(loaded);
    expect(again.schemaVersion).toBe(5);
  });
});
