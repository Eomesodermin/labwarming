import { DAY_END_HOUR, DAY_START_HOUR, TICKS_PER_DAY, TICKS_PER_SECOND } from '../content/balance';
import { EQUIPMENT } from '../content/equipment';
import { JOBS, jobsForStation } from '../content/jobs';
import { TODO_STEPS, type TodoStat } from '../content/tutorial';
import { PLAYER_ID } from './commands';
import { baseTile } from './grid';
import { coldCapacity, coldUsed, dryCapacity, dryUsed, plotOf, wasteCapacity } from './stock';
import { atStation, facedStation, jobBlocker } from './systems/jobs';
import { slotsOf } from './systems/cultures';
import type { Agent, Equipment, GameState, Plot } from './types';

/** Time of day on the 24 hour clock. The day runs from 08:00 to 18:00. */
export function clockTime(state: GameState): { hour: number; minute: number } {
  const minutesIntoDay = Math.floor((state.clock.tickOfDay * (DAY_END_HOUR - DAY_START_HOUR) * 60) / TICKS_PER_DAY);
  return { hour: DAY_START_HOUR + Math.floor(minutesIntoDay / 60), minute: minutesIntoDay % 60 };
}

export function formatClock(state: GameState): string {
  const { hour, minute } = clockTime(state);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getPlayer(state: GameState): Agent {
  const p = state.agents[PLAYER_ID];
  if (!p) throw new Error('The player agent is missing');
  return p;
}

export interface PromptOption {
  /** The key that starts it: E for the first job, Q for the second. */
  key: 'E' | 'Q';
  jobId: string;
  name: string;
  /** Why it cannot be done right now, or null. */
  reason: string | null;
}

export interface StationPrompt {
  stationId: string;
  stationName: string;
  options: PromptOption[];
  /** One line of extra information, such as how full the bin is. */
  info: string | null;
  /** The job being worked here, with progress 0 to 1. */
  working: { jobName: string; fraction: number } | null;
}

function stationInfo(state: GameState, eq: Equipment): string | null {
  const plotId = plotOf(eq);
  const plot = plotId ? state.plots[plotId] : undefined;
  switch (eq.defId) {
    case 'bin':
      return plot ? `Waste ${plot.waste}/${wasteCapacity(state, plotId as string)}` : null;
    case 'spray':
      return plot ? `Room cleanliness ${Math.round(plot.cleanliness)}%` : null;
    case 'incubator': {
      const mine = state.cultures.filter((c) => c.incubatorId === eq.id);
      const ready = mine.filter((c) => c.status === 'ready').length;
      const bad = mine.filter((c) => c.status === 'contaminated').length;
      const growing = mine.filter((c) => c.status === 'growing');
      const next = growing.length > 0 ? Math.ceil(Math.min(...growing.map((c) => c.growTicksLeft)) / TICKS_PER_SECOND) : 0;
      const parts = [`Cultures ${mine.length}/${slotsOf(eq)}`];
      if (ready) parts.push(`${ready} ready`);
      if (bad) parts.push(`${bad} contaminated`);
      if (growing.length) parts.push(`next ready in ${next} s`);
      return parts.join(', ');
    }
    case 'fridge':
      return `Cold storage ${coldUsed(state)}/${coldCapacity(state)}${eq.broken ? ' (broken, holds less)' : ''}`;
    case 'shelf':
      return `Dry storage ${dryUsed(state)}/${dryCapacity(state)}`;
    default:
      return null;
  }
}

/** What to show when the player faces a piece of equipment from the front, or null. */
export function stationPrompt(state: GameState): StationPrompt | null {
  const player = getPlayer(state);
  if (player.path.length > 0) return null;
  const eq = facedStation(state, player);
  if (!eq || !atStation(player, eq)) return null;
  const defs = jobsForStation(eq.defId);
  const options: PromptOption[] = defs.slice(0, 2).map((d, i) => ({
    key: i === 0 ? 'E' : 'Q',
    jobId: d.id,
    name: d.name,
    reason: jobBlocker(state, d, eq),
  }));
  const job = player.jobId ? state.jobs[player.jobId] : undefined;
  const working =
    job && job.stationId === eq.id
      ? { jobName: JOBS[job.defId as keyof typeof JOBS]?.name ?? '', fraction: job.progressTicks / job.totalTicks }
      : null;
  return { stationId: eq.id, stationName: EQUIPMENT[eq.defId]?.name ?? eq.defId, options, info: stationInfo(state, eq), working };
}

export interface TodoItem {
  id: string;
  text: string;
  hint: string;
  done: boolean;
}

/** The sticky-note to-do list. Steps tick off from the stats counters. */
export function todoList(state: GameState): TodoItem[] {
  const value = (stat: TodoStat): number => {
    switch (stat) {
      case 'readyCultures':
        return state.stats.culturesGrown;
      default:
        return state.stats[stat];
    }
  };
  return TODO_STEPS.map((s) => ({ id: s.id, text: s.text, hint: s.hint, done: value(s.stat) >= s.target }));
}

export function roomOfPlayer(state: GameState): Plot | null {
  const p = getPlayer(state);
  const id = baseTile(p.x, p.y).plotId;
  return id ? (state.plots[id] ?? null) : null;
}
