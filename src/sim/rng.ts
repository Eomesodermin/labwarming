import type { GameState } from './types';

/** mulberry32. Returns the next state and a float in [0, 1). Pure. */
export function mulberry32(stateIn: number): { state: number; value: number } {
  const state = (stateIn + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** Next float in [0, 1) from the generator kept in the game state. */
export function nextFloat(state: GameState): number {
  const r = mulberry32(state.rngState);
  state.rngState = r.state;
  return r.value;
}

/** Next integer in [0, n). */
export function nextInt(state: GameState, n: number): number {
  return Math.floor(nextFloat(state) * n);
}

/** True with the given probability (0 to 1). */
export function chance(state: GameState, p: number): boolean {
  return nextFloat(state) < p;
}

/** Turns any integer seed into a well-mixed 32-bit generator state. */
export function seedToState(seed: number): number {
  return mulberry32(seed >>> 0).state;
}
