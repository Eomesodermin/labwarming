import { DAY_END_HOUR, DAY_START_HOUR, TICKS_PER_DAY } from '../content/balance';
import { PLAYER_ID } from './commands';
import type { Agent, GameState } from './types';

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
