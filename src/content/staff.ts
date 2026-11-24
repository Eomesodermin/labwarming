// Staff: roles, traits, names and the numbers behind Energy and Mood (design doc 4.5).
// Change numbers here, not in the systems.

import type { RoomTypeId } from '../sim/types';
import type { JobId } from './jobs';

export type StaffRole = 'technician' | 'washup' | 'cleaner';
export const HIREABLE_ROLES: readonly StaffRole[] = ['technician', 'washup', 'cleaner'];

export type TraitId =
  | 'goldenHands'
  | 'labelsEverything'
  | 'coffeePowered'
  | 'humsWhilePipetting'
  | 'earlyBird'
  | 'tidy'
  | 'chatty'
  | 'hasSeenThings';

/** Portrait colours. These are palette names, so the art layer decides the exact colour. */
export type PortraitColour = 'terracotta' | 'mustard' | 'sage' | 'teal' | 'sky' | 'dustyRose' | 'berry' | 'butter';
export const PORTRAIT_COLOURS: readonly PortraitColour[] = ['terracotta', 'mustard', 'sage', 'teal', 'sky', 'dustyRose', 'berry', 'butter'];

export interface RoleDef {
  id: StaffRole;
  name: string;
  fee: number;
  /** Funds per day, paid at 18:00. */
  salary: number;
  /** Job speed against the player (0.8 means a job takes 1.25 times as long). */
  speed: number;
  /** Reputation needed to hire. */
  unlockRep: number;
  /** A room type that must be owned. */
  needsRoom?: RoomTypeId;
  /** The number of rooms that must be owned. */
  needsRooms?: number;
  /** Why the role is locked, in words. */
  lockedText: string;
  /** Job priority, first to last. */
  priority: readonly JobId[];
  /** A line of lab humour for the hire panel. */
  blurb: string;
}

export const ROLES: Record<StaffRole, RoleDef> = {
  technician: {
    id: 'technician',
    name: 'Technician',
    fee: 200,
    salary: 60,
    speed: 0.8,
    unlockRep: 10,
    lockedText: 'Needs Reputation 10',
    priority: ['binCulture', 'runExperiment', 'splitCells', 'makeMedia', 'putAwayOrder'],
    blurb: 'Splits, runs and bins. Knows where the good pipettes hide.',
  },
  washup: {
    id: 'washup',
    name: 'Wash-up crew',
    fee: 120,
    salary: 35,
    speed: 1.0,
    unlockRep: 0,
    needsRoom: 'washup',
    lockedText: 'Needs a Wash-up Room',
    priority: ['loadAutoclave', 'washFlask', 'putAwayOrder'],
    blurb: 'Believes every flask can be saved. Most of them are right.',
  },
  cleaner: {
    id: 'cleaner',
    name: 'Cleaner',
    fee: 100,
    salary: 30,
    speed: 1.0,
    unlockRep: 0,
    needsRooms: 2,
    lockedText: 'Needs 2 rooms',
    priority: ['takeOutWaste', 'tidyUp'],
    blurb: 'Has opinions about the bin. Mostly positive ones.',
  },
};

/** At most this many of each role. */
export const MAX_PER_ROLE = 2;
/** Candidates shown per role. They refresh each morning. */
export const CANDIDATES_PER_ROLE = 3;

export interface TraitDef {
  id: TraitId;
  name: string;
  text: string;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  goldenHands: { id: 'goldenHands', name: 'Golden Hands', text: 'Cultures they split have half the contamination chance.' },
  labelsEverything: { id: 'labelsEverything', name: 'Labels Everything', text: 'Puts away orders 30% faster.' },
  coffeePowered: { id: 'coffeePowered', name: 'Coffee Powered', text: 'Works 15% faster. Energy drains 50% faster.' },
  humsWhilePipetting: { id: 'humsWhilePipetting', name: 'Hums While Pipetting', text: 'Everyone else in the same room gets +5 Mood.' },
  earlyBird: { id: 'earlyBird', name: 'Early Bird', text: '15% faster before 12:00. 5% slower after.' },
  tidy: { id: 'tidy', name: 'Tidy', text: 'Their jobs do not reduce Cleanliness.' },
  chatty: { id: 'chatty', name: 'Chatty', text: 'Breaks take 50% longer. Everyone gets +5 Mood while they are on break.' },
  hasSeenThings: { id: 'hasSeenThings', name: 'Has Seen Things', text: 'Ignores all Mood penalties. Twenty years in the same lab.' },
};

export const TRAIT_ORDER: readonly TraitId[] = [
  'goldenHands',
  'labelsEverything',
  'coffeePowered',
  'humsWhilePipetting',
  'earlyBird',
  'tidy',
  'chatty',
  'hasSeenThings',
];

export const TRAIT_TUNING = {
  labelsEverythingPutAway: 1.3,
  coffeePoweredSpeed: 1.15,
  coffeePoweredDrain: 1.5,
  earlyBirdMorning: 1.15,
  earlyBirdAfternoon: 0.95,
  /** Early Bird: the morning ends at this hour. */
  earlyBirdUntilHour: 12,
  chattyBreak: 1.5,
  chattyMood: 5,
  humMood: 5,
  goldenContamination: 0.5,
} as const;

export const STAFF_NAMES: readonly string[] = [
  'Ansel', 'Birgit', 'Caspian', 'Dorrie', 'Emre', 'Fenna', 'Gus', 'Hanneke', 'Ilse', 'Jory',
  'Kasimir', 'Lotte', 'Milo', 'Nour', 'Odile', 'Pim', 'Runa', 'Sorrel', 'Tavi', 'Wren',
];

/** Energy runs 0 to 100. It drops by 1 for every this many seconds of work. */
export const ENERGY = {
  max: 100,
  drainEverySec: 4,
  /** At this level or below, the person finishes the current job and takes a break. */
  breakAt: 20,
  /** A break with no coffee machine to walk to, in seconds. */
  noCoffeeBreakSec: 40,
} as const;

export const MOOD = {
  base: 60,
  everySec: 10,
  coffee: 10,
  sofa: 10,
  plantEach: 2,
  plantMax: 3,
  cleanRoom: { atLeast: 70, bonus: 10 },
  dirtyRoom: { below: 40, penalty: -10 },
  fullBin: -10,
  piRequest: -5,
  cake: 20,
  /** Job speed at Mood 0 and at Mood 100, linear between. */
  speedAtZero: 0.9,
  speedAtMax: 1.1,
  /** A rain cloud shows over their head below this Mood. */
  cloudBelow: 40,
} as const;

/** Salaries and the negative-funds rule (design doc 5.3). */
export const PAYROLL = {
  /** Funds never go below this because of salaries. */
  floor: -500,
  coveredText: "Covered from Prof. Quince's discretionary account. She will mention it.",
} as const;

/** How idle staff choose work. */
export const STAFF_AI = {
  /** Idle staff look for a job every this many ticks. */
  thinkEveryTicks: 5,
  /** A cleaner takes out waste first once the bin is this full (a fraction of its capacity). Otherwise only when idle. */
  wasteFraction: 0.5,
  /** The wash-up crew starts the autoclave first once this many dirty flasks wait. Otherwise only when idle. */
  autoclaveMinFlasks: 4,
} as const;
