// All game state is plain JSON data: no classes, no functions, no Maps or Sets.
// Entities refer to each other by id.

import type { Stock } from '../content/items';

export type Dir = 'up' | 'down' | 'left' | 'right';

/** Equipment rotation. The number is the direction the front of the item faces: 0 down, 1 left, 2 up, 3 right. */
export type Rot = 0 | 1 | 2 | 3;

export interface Point {
  x: number;
  y: number;
}

export type Speed = 0 | 1 | 2;

export type RoomTypeId = 'lab' | 'washup' | 'break' | 'office' | 'media';

export type EquipmentDefId = string;

export interface Clock {
  /** Day number, starting at 1. */
  day: number;
  /** Ticks since 08:00 on the current day, 0 to TICKS_PER_DAY - 1. */
  tickOfDay: number;
  /** 0 is paused. */
  speed: Speed;
  /** The speed that Pause toggles back to. Always 1 or 2. */
  resumeSpeed: 1 | 2;
}

export interface Plot {
  id: string;
  owned: boolean;
  roomType: RoomTypeId | null;
  /** 0 to 100. */
  cleanliness: number;
  /** Waste bags in the room's bin or bins. */
  waste: number;
}

export interface Equipment {
  id: string;
  defId: EquipmentDefId;
  tier: number;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  rot: Rot;
  broken: boolean;
}

export type AgentKind = 'player';

export interface Agent {
  id: string;
  kind: AgentKind;
  /** The tile the agent stands on. While moving, the agent is between (x, y) and path[0]. */
  x: number;
  y: number;
  facing: Dir;
  /** Tiles still to walk, next tile first. */
  path: Point[];
  /** 0 to 99. At 100 the agent steps onto path[0]. */
  moveProgress: number;
  /** Direction to turn to once the path is finished (used to face a station). */
  arriveFacing: Dir | null;
  /** The job being worked. It only progresses while the agent stands in front of its station. */
  jobId: string | null;
  /** A station to start the default job at once the agent arrives (set by clicking a station). */
  pendingStation: string | null;
}

export type CultureStatus = 'growing' | 'ready' | 'contaminated';

export interface Culture {
  id: string;
  /** The incubator whose slot it fills. */
  incubatorId: string;
  /** Ticks left to grow. */
  growTicksLeft: number;
  status: CultureStatus;
}

export interface Job {
  id: string;
  defId: string;
  stationId: string;
  workerId: string;
  progressTicks: number;
  totalTicks: number;
  /** The sweet-spot green zone, in ticks of progress. */
  sweetStart: number;
  sweetEnd: number;
  /** One press per job. */
  sweetPressed: boolean;
  sweetHit: boolean;
}

export interface Stats {
  splits: number;
  culturesGrown: number;
  experiments: number;
  washes: number;
  mediaMade: number;
  wasteTaken: number;
  tidies: number;
  binned: number;
  sweetHits: number;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: number;
  /** Total ticks simulated since the game began. Does not advance while paused. */
  tick: number;
  clock: Clock;
  playerName: string;
  /** Data from experiments. Spent on papers from milestone 3. */
  data: number;
  stock: Stock;
  plots: Record<string, Plot>;
  equipment: Record<string, Equipment>;
  agents: Record<string, Agent>;
  jobs: Record<string, Job>;
  cultures: Culture[];
  stats: Stats;
  /** Bumped on any change that affects walkability. Path caches are keyed by it. */
  gridVersion: number;
  flags: Record<string, boolean | number>;
  nextId: number;
}
