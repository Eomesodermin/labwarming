import { DAY_END_HOUR, DAY_START_HOUR, TICKS_PER_DAY, TICKS_PER_SECOND } from '../content/balance';
import type { GameState } from './types';

export function secondsToTicks(s: number): number {
  return Math.max(1, Math.round(s * TICKS_PER_SECOND));
}

/**
 * Game time as one number: ticks since 08:00 on Day 1. Deadlines and delayed events use it,
 * so they do not care where a day ends. It matches `state.tick` as long as the game never pauses.
 */
export function timelineTick(state: GameState): number {
  return (state.clock.day - 1) * TICKS_PER_DAY + state.clock.tickOfDay;
}

/** The timeline tick of a day and a tick of that day. */
export function timelineAt(day: number, tickOfDay: number): number {
  return (day - 1) * TICKS_PER_DAY + tickOfDay;
}

/** The clock time of a tick of the day, such as "11:00". */
export function clockText(tickOfDay: number): string {
  const minutes = Math.floor((tickOfDay * (DAY_END_HOUR - DAY_START_HOUR) * 60) / TICKS_PER_DAY);
  const h = DAY_START_HOUR + Math.floor(minutes / 60);
  return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** A timeline tick as words: "Day 3, 14:00". The end of a day reads as 18:00 of that day. */
export function describeTimeline(t: number): string {
  if (t > 0 && t % TICKS_PER_DAY === 0) return `Day ${t / TICKS_PER_DAY}, ${clockText(TICKS_PER_DAY)}`;
  return `Day ${Math.floor(t / TICKS_PER_DAY) + 1}, ${clockText(t % TICKS_PER_DAY)}`;
}

/** Game time left, as "1d 3h", "5h" or "40 min". A game day is ten game hours. */
export function describeLeft(ticks: number): string {
  const t = Math.max(0, ticks);
  const days = Math.floor(t / TICKS_PER_DAY);
  const hours = Math.floor((t % TICKS_PER_DAY) / (TICKS_PER_DAY / (DAY_END_HOUR - DAY_START_HOUR)));
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(1, Math.round(t / (TICKS_PER_DAY / (DAY_END_HOUR - DAY_START_HOUR)) * 60))} min`;
}
