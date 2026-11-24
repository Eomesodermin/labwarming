// All game state is plain JSON data: no classes, no functions, no Maps or Sets.
// Entities refer to each other by id.

import type { Stock } from '../content/items';
import type { PortraitColour, StaffRole, TraitId } from '../content/staff';

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
  /** The autoclave's running cycle, or null when idle. Always null for other equipment. */
  cycle: Cycle | null;
  /** Ticks left of a software update (a bench is out of use). Missing means 0. */
  outTicks?: number;
  /** Ticks until the engineer has fixed a broken autoclave. Missing means nobody is coming. */
  repairTicks?: number;
}

export interface Cycle {
  /** Flasks inside, waiting to come out clean. */
  flasks: number;
  /** Ticks of running left. At 0 the flasks come out as soon as the shelf has room. */
  ticksLeft: number;
}

/** The player, hired staff, and the visiting characters (Prof. Quince, Inspector Tock, Bodo and guests). */
export type AgentKind = 'player' | StaffRole | 'pi' | 'inspector' | 'courier' | 'visitor';

/** What only staff have: who they are, and their two needs. */
export interface StaffData {
  name: string;
  role: StaffRole;
  trait: TraitId;
  colour: PortraitColour;
  /** Funds per day, fixed when hired. */
  salary: number;
  /** 0 to 100. */
  energy: number;
  /** Ticks of work that have not yet cost a point of Energy. */
  workAcc: number;
  /** 0 to 100, recalculated every 10 s. */
  mood: number;
  /** Ticks left of a rest taken in place (no coffee machine to walk to). */
  restTicks: number;
}

/** Someone who can be hired. The list refreshes each morning. */
export interface Candidate {
  id: string;
  role: StaffRole;
  name: string;
  trait: TraitId;
  colour: PortraitColour;
}

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
  /** Null for the player. */
  staff: StaffData | null;
}

export type CultureStatus = 'growing' | 'ready' | 'contaminated';

export interface Culture {
  id: string;
  /** The incubator whose slot it fills. */
  incubatorId: string;
  /** Ticks left to grow. */
  growTicksLeft: number;
  status: CultureStatus;
  /** Split by someone with Golden Hands: half the contamination chance. */
  golden?: boolean;
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

export type PaperStatus = 'review' | 'revise' | 'accepted';

export interface Paper {
  id: string;
  /** 1 for the first paper of the save, and so on. Decides the scripted Reviewer 2 outcomes. */
  number: number;
  status: PaperStatus;
  /** Ticks left in review. Only counts down while status is 'review'. */
  reviewTicksLeft: number;
  /** Written after saying yes to "one more panel": it pays +15 Reputation instead of +10. */
  panel?: boolean;
}

export interface GrantProgress {
  status: 'applied' | 'awarded';
  /** Ticks left until the decision. */
  decisionTicksLeft: number;
}

/** An order on its way. */
export interface Order {
  id: string;
  orderId: string;
  ticksLeft: number;
  /** The courier gets it wrong: the box turns up in the corridor instead of at the bay. */
  lost?: boolean;
  /** Where Bodo takes the box. */
  dropAt?: Point;
  /** Bodo walks in when `ticksLeft` reaches this. */
  courierAt?: number;
  courierSent?: boolean;
}

/** A box that was delivered to the wrong place. It waits on a corridor tile with a question mark. */
export interface LostBox {
  id: string;
  orderId: string;
  qty: number;
  x: number;
  y: number;
}

/** A delivered box waiting at the delivery bay. `qty` shrinks if only part of it fits. */
export interface Box {
  id: string;
  orderId: string;
  qty: number;
}

export interface Email {
  id: string;
  /** The event row it came from, such as pi_welcome or paper_accepted. */
  kind: string;
  from: string;
  subject: string;
  body: string;
  day: number;
  tickOfDay: number;
  read: boolean;
  /** Answers the player can choose from. Missing for plain emails. */
  choices?: string[];
  /** The index of the answer that was chosen. */
  chosen?: number;
}

export interface Stats {
  ordersPlaced: number;
  papersWritten: number;
  presentations: number;
  boxesPutAway: number;
  splits: number;
  culturesGrown: number;
  experiments: number;
  washes: number;
  mediaMade: number;
  wasteTaken: number;
  tidies: number;
  binned: number;
  sweetHits: number;
  autoclaveCycles: number;
  plotsBought: number;
  contaminations: number;
  requestsDone: number;
  requestsMissed: number;
  inspectionsDone: number;
}

/** One deadline-driven grant call. Seedling is open from the start. The others open on a scripted beat. */
export interface GrantCall {
  announced: boolean;
  /** The day of the current deadline (17:00), or null if the grant has none. The portal crash moves it. */
  deadlineDay: number | null;
  /** 100, or 80 after a portal crash. */
  payPercent: number;
  crashes: number;
}

export type RequestStat = 'experiments' | 'splits' | 'presentations';

/** A PI request in progress. Progress is the stat now minus the stat when the request started. */
export interface ActiveRequest {
  /** The event row it came from, such as pi_quick_one. */
  id: string;
  /** Timeline tick at which it expires (see `timelineTick`). */
  dueT: number;
  needs: Array<{ stat: RequestStat; target: number; base: number }>;
}

export interface QueuedEvent {
  /** Timeline tick at which it fires. */
  atT: number;
  eventId: string;
  params?: Record<string, string>;
}

export type VisitKind = 'cake' | 'walkthrough' | 'inspection' | 'courier';

/** A walking character with somewhere to go: stops in order, then out through the entrance. */
export interface Visit {
  id: string;
  kind: VisitKind;
  /** The first one leads. Others follow the same route. */
  agentIds: string[];
  stops: Point[];
  /** Index of the stop being walked to or stood at. -1 before the first. */
  stop: number;
  arrived: boolean;
  /** Ticks left standing at the current stop. */
  wait: number;
  leaving: boolean;
}

export interface Director {
  /** The director's own random stream, so other sequences stay the same. */
  rngState: number;
  /** Scripted beats that already fired. */
  firedBeats: string[];
  /** Event id to the timeline tick before which it may not fire again. */
  cooldowns: Record<string, number>;
  requests: ActiveRequest[];
  /** The last outcome of each request event. */
  resolved: Record<string, 'done' | 'missed'>;
  queue: QueuedEvent[];
  lastRandomT: number;
  lastFailureT: number;
  visits: Visit[];
  /** Where the cake sits while its effect lasts. */
  cake: Point | null;
  /** The fire alarm test: staff stand outside until the countdown ends. */
  drill: { ticksLeft: number } | null;
  engineerCalls: number;
  /** Plots whose bin was full on the last check, so the warning email fires once per fill. */
  binsFull: string[];
}

export type InspectionCheck = 'logbook' | 'waste' | 'clean' | 'fridge';

export interface InspectionState {
  phase: 'announced' | 'visiting' | 'done';
  /** Timeline tick of the visit (11:00 the next day). */
  visitT: number;
  signed: boolean;
  /** Set to false the moment Tock sees a full bin or a dirty room. */
  wasteOk: boolean;
  cleanOk: boolean;
  /** The checks that were missed, once the visit is over. They stay as sticky notes until fixed. */
  missed: InspectionCheck[];
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: number;
  /** Total ticks simulated since the game began. Does not advance while paused. */
  tick: number;
  clock: Clock;
  playerName: string;
  funds: number;
  /** Data from experiments. Spent on papers, presentations and revisions. */
  data: number;
  reputation: number;
  papers: Paper[];
  presentations: number;
  grants: Record<string, GrantProgress>;
  /** Announcements and deadlines, by grant id. */
  grantCalls: Record<string, GrantCall>;
  orders: Order[];
  boxes: Box[];
  lostBoxes: LostBox[];
  director: Director;
  inspection: InspectionState | null;
  inbox: Email[];
  stock: Stock;
  plots: Record<string, Plot>;
  equipment: Record<string, Equipment>;
  agents: Record<string, Agent>;
  jobs: Record<string, Job>;
  cultures: Culture[];
  /** People who can be hired today, three per role. */
  candidates: Candidate[];
  stats: Stats;
  /** Bumped on any change that affects walkability. Path caches are keyed by it. */
  gridVersion: number;
  flags: Record<string, boolean | number>;
  nextId: number;
}
