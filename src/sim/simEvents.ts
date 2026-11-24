import type { Speed } from './types';

/** The event bus. `step` returns the events of one tick. They are for presentation only. */
export type SimEvent =
  | { type: 'CommandRejected'; reason: string }
  | { type: 'SpeedChanged'; speed: Speed }
  | { type: 'DayEnded'; day: number };
