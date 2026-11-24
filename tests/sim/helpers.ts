import { PLAYER_ID, type Command } from '../../src/sim/commands';
import { createInitialState } from '../../src/sim/createState';
import { ROT_FACING, frontTiles, opposite } from '../../src/sim/grid';
import type { SimEvent } from '../../src/sim/simEvents';
import { step } from '../../src/sim/step';
import type { Equipment, GameState } from '../../src/sim/types';

export function newGame(seed = 1): GameState {
  return createInitialState(seed);
}

export function equip(state: GameState, defId: string): Equipment {
  const e = Object.values(state.equipment).find((x) => x.defId === defId);
  if (!e) throw new Error(`no ${defId}`);
  return e;
}

/** Puts the player on the first front tile of a station, facing it. */
export function stand(state: GameState, defId: string): Equipment {
  const eq = equip(state, defId);
  const t = frontTiles(eq)[0];
  const p = state.agents[PLAYER_ID];
  if (!t || !p) throw new Error('cannot stand');
  p.x = t.x;
  p.y = t.y;
  p.path = [];
  p.moveProgress = 0;
  p.facing = opposite(ROT_FACING[eq.rot]);
  return eq;
}

export function run(state: GameState, ticks: number, first: Command[] = []): SimEvent[] {
  const out: SimEvent[] = [];
  out.push(...step(state, first));
  for (let i = 1; i < ticks; i++) out.push(...step(state, []));
  return out;
}

/** Starts the station's job with E and runs it to the end. Returns the events. */
export function doJob(state: GameState, defId: string, jobId?: string): SimEvent[] {
  const eq = stand(state, defId);
  const cmd: Command = jobId ? { type: 'Interact', jobId } : { type: 'Interact' };
  const events = step(state, [cmd]);
  const job = Object.values(state.jobs)[0];
  if (job) events.push(...run(state, job.totalTicks + 1));
  void eq;
  return events;
}

export const rejections = (ev: SimEvent[]): string[] =>
  ev.flatMap((e) => (e.type === 'CommandRejected' ? [e.reason] : []));
