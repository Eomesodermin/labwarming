import { TICKS_PER_DAY } from '../../content/balance';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';

/** Advances time by one tick. At the end of the day the next day starts at 08:00. */
export function clockSystem(state: GameState, events: SimEvent[]): void {
  state.tick += 1;
  state.clock.tickOfDay += 1;
  if (state.clock.tickOfDay >= TICKS_PER_DAY) {
    events.push({ type: 'DayEnded', day: state.clock.day });
    state.clock.tickOfDay = 0;
    state.clock.day += 1;
  }
}
