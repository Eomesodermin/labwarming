// Global constants. Change numbers here, not in the systems.

/** The sim runs at a fixed 10 ticks per second. One tick is 100 ms of game time. */
export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** One game day runs from 08:00 to 18:00 and lasts 4 real minutes at 1x. */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 18;
export const TICKS_PER_DAY = 2400;

/** Movement: progress added per tick. At STEP_COST the agent steps to the next tile. */
export const STEP_COST = 100;
export const PLAYER_MOVE_SPEED = 40;
export const STAFF_MOVE_SPEED = 30;

export const SCHEMA_VERSION = 1;

export const DEFAULT_PLAYER_NAME = 'Postdoc';
