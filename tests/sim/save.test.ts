import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../../src/content/balance';
import { PLAYER_ID } from '../../src/sim/commands';
import { SaveError, deserialize, restoreState, serialize } from '../../src/sim/save';
import { MIGRATIONS, migrate, type Migration } from '../../src/sim/save/migrate';
import { validateState } from '../../src/sim/save/validate';
import { step } from '../../src/sim/step';
import { newGame, run, stand } from './helpers';

function busyGame(): ReturnType<typeof newGame> {
  const s = newGame(77);
  s.data = 150;
  step(s, [{ type: 'PlaceOrder', orderId: 'flaskBox' }]);
  stand(s, 'desk');
  step(s, [{ type: 'Interact', jobId: 'writePaper' }]);
  run(s, 60); // half-way through writing a paper
  return s;
}

describe('save round trip', () => {
  it('gives back exactly the same state, including a half-finished job and the clock', () => {
    const s = busyGame();
    expect(Object.keys(s.jobs)).toHaveLength(1);
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
    expect(back.clock).toEqual(s.clock);
    expect(Object.values(back.jobs)[0]?.progressTicks).toBeGreaterThan(0);
    expect(back.agents[PLAYER_ID]?.jobId).toBe(s.agents[PLAYER_ID]?.jobId);
  });

  it('continues the same way after loading: same seed and commands give the same state', () => {
    const a = busyGame();
    const b = deserialize(serialize(a));
    run(a, 1500);
    run(b, 1500);
    expect(serialize(b)).toBe(serialize(a));
  });

  it('is saved at the current schema version', () => {
    expect(newGame().schemaVersion).toBe(SCHEMA_VERSION);
    expect(deserialize(serialize(newGame())).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('migrations', () => {
  const asRaw = (): Record<string, unknown> => JSON.parse(serialize(newGame())) as Record<string, unknown>;

  it('runs every step in order from the save version to the target', () => {
    const steps: Migration[] = [
      { from: 1, run: (s) => ({ ...s, addedIn2: true }) },
      { from: 2, run: (s) => ({ ...s, addedIn3: (s['addedIn2'] === true ? 'after2' : 'broken') }) },
    ];
    const out = migrate(asRaw(), 1, steps, 3);
    expect(out['addedIn2']).toBe(true);
    expect(out['addedIn3']).toBe('after2');
    expect(out['schemaVersion']).toBe(3);
    // Starting later skips the earlier steps.
    const later = migrate({ ...asRaw(), schemaVersion: 2 }, 2, steps, 3);
    expect(later['addedIn2']).toBeUndefined();
    expect(later['addedIn3']).toBe('broken');
  });

  it('does not change the input', () => {
    const raw = asRaw();
    const copy = JSON.stringify(raw);
    migrate(raw, 1, [{ from: 1, run: (s) => ({ ...s, x: 1 }) }], 2);
    expect(JSON.stringify(raw)).toBe(copy);
  });

  it('refuses a save from a newer game and a save with a missing step', () => {
    expect(() => migrate(asRaw(), 9, [], 3)).toThrow(/newer version/);
    expect(() => migrate(asRaw(), 1, [], 3)).toThrow(/No way to upgrade/);
    expect(() => migrate(asRaw(), 0)).toThrow(SaveError);
    expect(() => migrate(asRaw(), Number.NaN)).toThrow(SaveError);
  });

  it('has one step for every version below the current one', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) expect(MIGRATIONS.some((m) => m.from === v), `step ${v} to ${v + 1}`).toBe(true);
  });

  it('loads a current-version state through restoreState', () => {
    const s = newGame(3);
    expect(restoreState(JSON.parse(serialize(s)), SCHEMA_VERSION)).toEqual(s);
  });
});

describe('validation and corrupted saves', () => {
  it('fails safely, with a SaveError, on damaged input', () => {
    expect(() => deserialize('not json')).toThrow(SaveError);
    expect(() => deserialize('[]')).toThrow(SaveError);
    expect(() => deserialize('{}')).toThrow(SaveError);
    expect(() => deserialize('null')).toThrow(SaveError);
  });

  it('names what is wrong when a field is missing or has the wrong type', () => {
    const raw = JSON.parse(serialize(newGame())) as Record<string, unknown>;
    expect(() => validateState({ ...raw, funds: 'lots' })).toThrow(/funds/);
    const { inbox: _inbox, ...noInbox } = raw;
    void _inbox;
    expect(() => validateState(noInbox)).toThrow(/inbox/);
    expect(() => validateState({ ...raw, agents: {} })).toThrow(/player/);
    expect(() => validateState({ ...raw, clock: { day: 1, tickOfDay: 0, speed: 7, resumeSpeed: 1 } })).toThrow(/speed/);
  });
});

describe('migration from version 1 (milestone 3 saves)', () => {
  /** What a milestone 3 save looks like: no autoclave cycle on equipment, two fewer stats. */
  function m3Save(): Record<string, unknown> {
    const raw = JSON.parse(serialize(newGame(5))) as Record<string, unknown>;
    raw['schemaVersion'] = 1;
    for (const eq of Object.values(raw['equipment'] as Record<string, Record<string, unknown>>)) delete eq['cycle'];
    const stats = raw['stats'] as Record<string, unknown>;
    delete stats['autoclaveCycles'];
    delete stats['plotsBought'];
    return v2ToV1(raw);
  }

  /** Takes away what milestone 5 added, so the save looks like an older one. */
  function v2ToV1(raw: Record<string, unknown>): Record<string, unknown> {
    delete raw['candidates'];
    for (const a of Object.values(raw['agents'] as Record<string, Record<string, unknown>>)) delete a['staff'];
    return raw;
  }

  it('is rejected by validation before migrating and accepted after', () => {
    expect(() => validateState(m3Save())).toThrow();
    const loaded = restoreState(m3Save(), 1);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.values(loaded.equipment).every((e) => e.cycle === null)).toBe(true);
    expect(loaded.stats.autoclaveCycles).toBe(0);
    expect(loaded.stats.plotsBought).toBe(0);
  });

  it('gives back the same game as a new one with the same seed', () => {
    const expected = newGame(5);
    expected.candidates = []; // the game draws today's candidates on the next tick
    expect(deserialize(JSON.stringify(m3Save()))).toEqual(expected);
  });

  it('keeps a half-finished game playable and lets the old save build a room', () => {
    const raw = m3Save();
    (raw['plots'] as Record<string, Record<string, unknown>>)['b'] = { id: 'b', owned: false, roomType: null, cleanliness: 100, waste: 0 };
    const loaded = deserialize(JSON.stringify(raw));
    loaded.funds = 1000;
    step(loaded, [{ type: 'BuyPlot', plotId: 'c', roomType: 'washup' }]);
    expect(loaded.plots['c']?.owned).toBe(true);
    run(loaded, 100);
    expect(deserialize(serialize(loaded))).toEqual(loaded);
  });

  it('round trips a rearranged lab with a running autoclave', () => {
    const s = newGame(9);
    s.funds = 3000;
    step(s, [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }]);
    step(s, [{ type: 'PlaceEquipment', defId: 'autoclave', x: 12, y: 3, rot: 0 }]);
    step(s, [{ type: 'MoveEquipment', equipmentId: Object.values(s.equipment).find((e) => e.defId === 'bench')?.id ?? '', x: 3, y: 4, rot: 0 }]);
    const ac = Object.values(s.equipment).find((e) => e.defId === 'autoclave');
    if (ac) ac.cycle = { flasks: 4, ticksLeft: 120 };
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
    run(s, 300);
    run(back, 300);
    expect(serialize(back)).toBe(serialize(s));
  });
});

describe('migration from version 2 (milestone 4 saves)', () => {
  /** A milestone 4 save: schema 2, no staff record on agents, no candidates. */
  function m4Save(): Record<string, unknown> {
    const raw = JSON.parse(serialize(newGame(9))) as Record<string, unknown>;
    raw['schemaVersion'] = 2;
    delete raw['candidates'];
    for (const a of Object.values(raw['agents'] as Record<string, Record<string, unknown>>)) delete a['staff'];
    return raw;
  }

  it('is rejected by validation before migrating and accepted after', () => {
    expect(() => validateState(m4Save())).toThrow();
    const loaded = restoreState(m4Save(), 2);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.agents[PLAYER_ID]?.staff).toBeNull();
    expect(loaded.candidates).toEqual([]);
  });

  it('draws the candidates on the next tick and lets the old save hire', () => {
    const loaded = deserialize(JSON.stringify(m4Save()));
    loaded.reputation = 10;
    step(loaded, []);
    expect(loaded.candidates).toHaveLength(9);
    const cand = loaded.candidates.find((c) => c.role === 'technician');
    step(loaded, [{ type: 'HireStaff', candidateId: cand?.id ?? '' }]);
    expect(staffNames(loaded)).toEqual([cand?.name]);
    expect(deserialize(serialize(loaded))).toEqual(loaded);
  });

  it('keeps hired staff through a save and load, and carries on the same way', () => {
    const a = newGame(4);
    a.reputation = 10;
    const cand = a.candidates.find((c) => c.role === 'technician');
    step(a, [{ type: 'HireStaff', candidateId: cand?.id ?? '' }]);
    run(a, 300);
    const b = deserialize(serialize(a));
    expect(b).toEqual(a);
    run(a, 1200);
    run(b, 1200);
    expect(serialize(b)).toBe(serialize(a));
  });
});

function staffNames(s: ReturnType<typeof newGame>): string[] {
  return Object.values(s.agents).flatMap((a) => (a.staff ? [a.staff.name] : []));
}

describe('migration from version 3 (milestone 5 saves)', () => {
  /** A milestone 5 save: schema 3, none of the milestone 6 fields. */
  function m5Save(day = 1, tickOfDay = 0): Record<string, unknown> {
    const raw = JSON.parse(serialize(newGame(11))) as Record<string, unknown>;
    raw['schemaVersion'] = 3;
    for (const k of ['director', 'grantCalls', 'lostBoxes', 'inspection', 'facility', 'goals']) delete raw[k];
    const stats = raw['stats'] as Record<string, unknown>;
    for (const k of ['contaminations', 'requestsDone', 'requestsMissed', 'inspectionsDone', 'hires', 'prepBottles', 'mediaSold', 'visitorsServed']) delete stats[k];
    (raw['clock'] as Record<string, unknown>)['day'] = day;
    (raw['clock'] as Record<string, unknown>)['tickOfDay'] = tickOfDay;
    return raw;
  }

  it('is rejected by validation before migrating and accepted after', () => {
    expect(() => validateState(m5Save())).toThrow();
    const loaded = restoreState(m5Save(), 3);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.inspection).toBeNull();
    expect(loaded.lostBoxes).toEqual([]);
    expect(loaded.director.requests).toEqual([]);
    expect(loaded.stats.requestsDone).toBe(0);
  });

  it('gives back the same game as a new one with the same seed, for a save from the first minute', () => {
    expect(deserialize(JSON.stringify(m5Save()))).toEqual(newGame(11));
  });

  it('opens Seedling only, and keeps later grants closed for an early save', () => {
    const loaded = deserialize(JSON.stringify(m5Save(2, 100)));
    expect(loaded.grantCalls['seedling']?.announced).toBe(true);
    expect(loaded.grantCalls['equipment']).toMatchObject({ announced: false, deadlineDay: null });
    expect(loaded.grantCalls['foundation']?.announced).toBe(false);
  });

  it('does not replay the first week for a later save: past beats count as fired and past grants are open', () => {
    const raw = m5Save(6, 1000);
    (raw['grants'] as Record<string, unknown>)['equipment'] = { status: 'awarded', decisionTicksLeft: 0 };
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.director.firedBeats).toContain('pi_quick_one');
    expect(loaded.director.firedBeats).toContain('fail_contamination');
    expect(loaded.director.firedBeats).toContain('insp_notice@5');
    expect(loaded.director.firedBeats).toContain('grant_announce_foundation');
    expect(loaded.director.firedBeats).not.toContain('pi_slides_tonight');
    expect(loaded.grantCalls['equipment']).toMatchObject({ announced: true, deadlineDay: 5 });
    expect(loaded.grantCalls['foundation']).toMatchObject({ announced: true, deadlineDay: 10 });
    const before = loaded.inbox.length;
    run(loaded, 40);
    expect(loaded.inbox.length).toBe(before);
  });

  it('loads, plays on, and saves again at the current version', () => {
    const loaded = deserialize(JSON.stringify(m5Save(3, 200)));
    run(loaded, 500);
    expect(loaded.grantCalls['equipment']?.announced).toBe(true); // the Day 3, 09:00 beat plays as normal
    const again = deserialize(serialize(loaded));
    expect(again).toEqual(loaded);
    expect(again.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('rejects a damaged director', () => {
    const raw = JSON.parse(serialize(newGame())) as Record<string, unknown>;
    expect(() => validateState({ ...raw, director: { rngState: 1 } })).toThrow(/director/);
    expect(() => validateState({ ...raw, grantCalls: { x: { announced: 'yes' } } })).toThrow(/grant call/);
  });
});
