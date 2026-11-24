import { SCHEMA_VERSION, TICKS_PER_DAY } from '../../content/balance';
import { GRANTS } from '../../content/economy';
import { FACILITY } from '../../content/facility';
import { SCRIPTED_BEATS, hourToTick } from '../../content/events';
import { seedToState } from '../rng';

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
  {
    // Version 3 to 4 (milestone 6): the event director, grant deadlines, lost boxes and the inspection.
    // Beats whose time has already passed count as fired, so an old save does not replay its first week.
    from: 3,
    run: (state) => {
      const clock = (state['clock'] ?? {}) as Raw;
      const day = typeof clock['day'] === 'number' ? clock['day'] : 1;
      const tod = typeof clock['tickOfDay'] === 'number' ? clock['tickOfDay'] : 0;
      const seed = typeof state['seed'] === 'number' ? state['seed'] : 1;
      const past = (d: number, hour: number): boolean => day > d || (day === d && tod >= hourToTick(hour));
      const fired: string[] = ['pi_welcome'];
      for (const b of SCRIPTED_BEATS) {
        if (b.everyDays) {
          const occ = day >= b.day ? b.day + Math.floor((day - b.day) / b.everyDays) * b.everyDays : b.day;
          for (let d = b.day; d <= occ; d += b.everyDays) if (past(d, b.hour)) fired.push(`${b.key}@${d}`);
        } else if (past(b.day, b.hour)) {
          fired.push(b.key, b.event);
        }
      }
      const grants = (state['grants'] ?? {}) as Raw;
      const calls: Record<string, Raw> = {};
      for (const g of GRANTS) {
        const beat = SCRIPTED_BEATS.find((b) => b.event === 'grant_announce' && b.params?.['grantId'] === g.id);
        const announced = g.deadlineDay === null || (beat ? past(beat.day, beat.hour) : false);
        calls[g.id] = { announced, deadlineDay: announced ? g.deadlineDay : null, payPercent: 100, crashes: 0 };
        // A deadline that has already gone by moves on, as the portal would have done.
        const call = calls[g.id] as Raw;
        if (announced && g.deadlineDay !== null && grants[g.id] === undefined && day > g.deadlineDay) call['deadlineDay'] = day;
      }
      const t = (day - 1) * TICKS_PER_DAY + tod;
      state['grantCalls'] = calls;
      state['lostBoxes'] = [];
      state['inspection'] = null;
      state['director'] = {
        rngState: seedToState((seed ^ 0x2f6e2b1) >>> 0),
        firedBeats: fired,
        cooldowns: {},
        requests: [],
        resolved: {},
        queue: [],
        lastRandomT: t,
        lastFailureT: -1_000_000,
        visits: [],
        cake: null,
        drill: null,
        engineerCalls: 0,
        binsFull: [],
      };
      const stats = state['stats'];
      if (typeof stats === 'object' && stats !== null) {
        const st = stats as Raw;
        for (const k of ['contaminations', 'requestsDone', 'requestsMissed', 'inspectionsDone']) if (st[k] === undefined) st[k] = 0;
      }
      return state;
    },
  },
  {
    // Version 4 to 5 (milestone 7): the Media Facility settings, the Lab Warming list and four counters.
    // Goals that are already met are ticked on the next tick, at the play time of the load.
    from: 4,
    run: (state) => {
      state['facility'] = { target: FACILITY.targetDefault, autoReorder: FACILITY.autoReorderDefault, batchLeft: 0, visitorTicks: -1, earned: 0 };
      state['goals'] = { reached: {}, partyDone: false, prompted: [] };
      const agents = (state['agents'] ?? {}) as Record<string, Raw>;
      const hired = Object.values(agents).filter((a) => typeof a === 'object' && a !== null && a['staff'] !== null && a['staff'] !== undefined).length;
      const stats = state['stats'];
      if (typeof stats === 'object' && stats !== null) {
        const st = stats as Raw;
        if (st['hires'] === undefined) st['hires'] = hired;
        for (const k of ['prepBottles', 'mediaSold', 'visitorsServed']) if (st[k] === undefined) st[k] = 0;
      }
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
