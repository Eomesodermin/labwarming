import type { GameHost } from '../host';
import { writeSave } from '../platform/saveStore';
import { createInitialState } from '../sim/createState';
import type { GameState } from '../sim/types';

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}

export function freshGame(): GameState {
  return createInitialState(randomSeed());
}

/**
 * Replaces the running game with another one (new game or an imported save). The game being
 * replaced is written first, so it becomes the backup (design doc 9).
 */
export function swapGame(host: GameHost, next: GameState): boolean {
  if (host.saving) writeSave(host.state);
  const ok = writeSave(next);
  host.replaceState(next);
  return ok;
}
