import { TUNING } from '../../content/jobs';
import type { GameState } from '../types';

/** A job finished in this room: the room gets a little dirtier. */
export function dirtyRoom(state: GameState, plotId: string | null): void {
  const plot = plotId ? state.plots[plotId] : undefined;
  if (plot) plot.cleanliness = Math.max(0, plot.cleanliness - TUNING.dirtPerJob);
}

export function cleanRoom(state: GameState, plotId: string | null, amount: number): void {
  const plot = plotId ? state.plots[plotId] : undefined;
  if (plot) plot.cleanliness = Math.min(100, plot.cleanliness + amount);
}
