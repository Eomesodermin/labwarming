import { FRIDGE_WARM } from '../../content/events';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';

/**
 * Scripted events. In milestone 3 this is only the warm fridge, as a toast: 13:00 on any day
 * while a fridge is broken, at most once a day. It costs one bottle of media. The full event
 * director with emails, choices and the random pool arrives in milestone 6.
 */
export function directorSystem(state: GameState, events: SimEvent[]): void {
  if (state.clock.tickOfDay !== FRIDGE_WARM.tickOfDay) return;
  if (state.flags['fridgeWarmDay'] === state.clock.day) return;
  if (!Object.values(state.equipment).some((e) => e.defId === 'fridge' && e.broken)) return;
  state.flags['fridgeWarmDay'] = state.clock.day;
  if (state.stock.media > 0) state.stock.media -= 1;
  events.push({ type: 'Toast', text: FRIDGE_WARM.text });
}
