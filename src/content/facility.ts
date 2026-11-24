// The Media Facility, the Lab Warming goals, the party and the feedback prompts
// (design doc 4.6, 2.4 and 10). Change numbers and text here, not in the systems.

import type { OrderId } from './orders';

/** The Media Facility ("the Media Kitchen"). */
export const FACILITY = {
  /** The media prep unit makes one bottle this often. */
  bottleSec: 15,
  /** Bottles from one powder here. By hand a powder makes 3. */
  bottlesPerPowder: 6,
  /** The target level slider. */
  targetDefault: 8,
  targetMin: 2,
  targetMax: 20,
  /** The auto-reorder switch starts on, so a new facility never runs dry unseen. */
  autoReorderDefault: true,
  /** With auto-reorder on, a powder box is ordered whenever powder stock drops below this. */
  reorderBelow: 2,
  reorderOrder: 'mediaPowderBox' as OrderId,
  /** A researcher from next door walks in this often (a random time between the two). */
  visitorMinSec: 60,
  visitorMaxSec: 90,
  /** The first visitor comes this long after the facility opens. */
  firstVisitorSec: 30,
  /** Visitors only buy while media stock is above this. They take two bottles at 15 each. */
  reserve: 4,
  bottlesPerVisitor: 2,
  pricePerBottle: 15,
  /** How long a visitor stands in the room. */
  visitorDwellSec: 5,
} as const;

/** What visitors say when they buy. One is drawn each time. */
export const VISITOR_LINES: readonly string[] = [
  'Do you have any without phenol red? No? Fine.',
  'Two bottles, please. Our own media is "still thinking about it".',
  'I only came for the media. And to see if you have biscuits.',
  'Is it filtered? Of course it is filtered. Sorry I asked.',
  'We ran out again. Please do not tell my supervisor.',
  'Smells like a bakery in here. A very sterile bakery.',
];

/** What a visitor says when stock is at or under the reserve. */
export const VISITOR_EMPTY_LINES: readonly string[] = [
  'The shelf is looking thin. I will come back later.',
  'You are keeping the rest for yourselves? Fair enough.',
];

export type GoalId = 'rooms' | 'staff' | 'facility' | 'request' | 'grant';

export interface GoalDef {
  id: GoalId;
  /** The line on the Lab Warming list. */
  text: string;
  /** How many to reach. */
  need: number;
  /** One line on how to do it. */
  hint: string;
}

/** The v1 goal checklist (design doc 2.4), in order. */
export const GOALS: readonly GoalDef[] = [
  { id: 'rooms', text: 'Own 4 rooms', need: 4, hint: 'Press B for build mode and buy plots. The first Lab counts.' },
  { id: 'staff', text: 'Hire 2 different kinds of staff', need: 2, hint: 'Press T, then the Hire tab. A Wash-up crew and a Technician are a good pair.' },
  { id: 'facility', text: 'Open 1 facility', need: 1, hint: 'Buy a Media Facility room (Reputation 30) and put a media prep unit in it.' },
  { id: 'request', text: 'Get through 1 request from Prof. Quince', need: 1, hint: 'Her emails often ask for something. Finish it in time.' },
  { id: 'grant', text: 'Get 1 grant in before its deadline', need: 1, hint: 'Write the Equipment Call application at the desk.' },
];

/** The Lab Warming Party. */
export const PARTY = {
  title: 'The Lab Warming Party',
  line: 'Cake in the corridor. Confetti on the bench. Somebody has found a speaker.',
  caption: 'Group photo. Reviewer 2 is the one who is not in it.',
  email: {
    subject: 'Party!',
    body: 'I have been told the lab is now a lab. Cake is in the corridor. Nobody mention the fridge.',
  },
};

/** The feedback prompts (design doc 10). They show once each and never again. */
export const PROMPTS = {
  text: 'Got a minute? Tell us one thing you liked and one thing you did not.',
  /** The second prompt appears at 30 minutes of play time. */
  thirtyMinSec: 30 * 60,
};
