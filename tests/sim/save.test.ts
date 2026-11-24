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
  s.data = 80;
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
