import type { Speed } from './types';

/** The event bus. `step` returns the events of one tick. They are for presentation only. */
export type SimEvent =
  | { type: 'CommandRejected'; reason: string }
  | { type: 'SpeedChanged'; speed: Speed }
  | { type: 'DayEnded'; day: number }
  | { type: 'JobStarted'; jobId: string; defId: string; stationId: string }
  | { type: 'JobCompleted'; defId: string; stationId: string }
  | { type: 'SweetSpot'; stationId: string; hit: boolean }
  | { type: 'CultureReady'; cultureId: string }
  | { type: 'CultureContaminated'; cultureId: string }
  | { type: 'Toast'; text: string };
