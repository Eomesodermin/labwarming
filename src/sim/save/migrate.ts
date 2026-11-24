import { SCHEMA_VERSION } from '../../content/balance';

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

type Raw = Record<string, unknown>;

export interface Migration {
  /** The schema version this step upgrades from. It produces `from + 1`. */
  from: number;
  run: (state: Raw) => Raw;
}

/**
 * One function per schema step (1 to 2, 2 to 3, ...), in order. Every change to `GameState`
 * after milestone 3 must bump `SCHEMA_VERSION` and add a step here, with a test.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    // Version 1 to 2 (milestone 4): equipment gains an autoclave cycle, stats gain two counters.
    from: 1,
    run: (state) => {
      const equipment = state['equipment'];
      if (typeof equipment === 'object' && equipment !== null) {
        for (const eq of Object.values(equipment as Record<string, Raw>)) {
          if (eq['cycle'] === undefined) eq['cycle'] = null;
        }
      }
      const stats = state['stats'];
      if (typeof stats === 'object' && stats !== null) {
        const st = stats as Raw;
        if (st['autoclaveCycles'] === undefined) st['autoclaveCycles'] = 0;
        if (st['plotsBought'] === undefined) st['plotsBought'] = 0;
      }
      return state;
    },
  },
  {
    // Version 2 to 3 (milestone 5): agents gain a staff record (null for the player), the state gains
    // a candidates list (the game draws today's candidates on the next tick) and cultures may be golden.
    from: 2,
    run: (state) => {
      const agents = state['agents'];
      if (typeof agents === 'object' && agents !== null) {
        for (const a of Object.values(agents as Record<string, Raw>)) {
          if (a['staff'] === undefined) a['staff'] = null;
        }
      }
      if (state['candidates'] === undefined) state['candidates'] = [];
      return state;
    },
  },
];

/** Runs every step from the save's version to the target version. The input is not changed. */
export function migrate(
  state: Raw,
  fromVersion: number,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): Raw {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) throw new SaveError('The save has no valid version number');
  if (fromVersion > target) throw new SaveError('This save is from a newer version of the game');
  let current: Raw = (JSON.parse(JSON.stringify(state)) as Raw);
  for (let v = fromVersion; v < target; v++) {
    const step = migrations.find((m) => m.from === v);
    if (!step) throw new SaveError(`No way to upgrade a version ${v} save`);
    current = step.run(current);
    current['schemaVersion'] = v + 1;
  }
  return current;
}
