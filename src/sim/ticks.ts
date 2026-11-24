import { TICKS_PER_SECOND } from '../content/balance';

export function secondsToTicks(s: number): number {
  return Math.max(1, Math.round(s * TICKS_PER_SECOND));
}
