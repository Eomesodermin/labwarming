import { CORE_FUNDING } from '../../content/economy';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';

/** The end of the day at 18:00: core funding arrives. Salaries join in milestone 5. */
export function endOfDay(state: GameState, endedDay: number, events: SimEvent[]): void {
  state.funds += CORE_FUNDING;
  events.push({ type: 'EndOfDay', day: endedDay, funding: CORE_FUNDING, funds: state.funds });
}
