// Event rows (design doc 6.2 and 6.3): ids, senders, text, conditions, effects and choices.
// Every event is data. The event director in `sim/systems/director.ts` reads these rows and
// no event logic is hard-coded in the systems. Change text and numbers here.

import { DAY_END_HOUR, DAY_START_HOUR, TICKS_PER_DAY } from './balance';
import type { StockItem } from './items';

export const PI_NAME = 'Prof. Quince';
export const REVIEWER_NAME = 'Reviewer 2';
export const TOCK_NAME = 'Inspector Tock';
export const BODO_NAME = 'Bodo';
export const LAB_NAME = 'Lab notes';
export const FACILITIES_NAME = 'Facilities';
export const ENGINEER_NAME = 'The engineer';

/** Quince signs every email. The director adds this to the end of her emails. */
export const PI_SIGNOFF = 'Best, W\nSent from my phone';

/** The tick of the day at an hour of the clock. 08:00 is tick 0 and 18:00 is the end of the day. */
export function hourToTick(hour: number): number {
  return Math.round(((hour - DAY_START_HOUR) * TICKS_PER_DAY) / (DAY_END_HOUR - DAY_START_HOUR));
}

/** Numbers behind the event director. */
export const DIRECTOR = {
  /** The random pool is looked at this often, and may fire at most once every `randomGapSec`. */
  checkEverySec: 10,
  randomGapSec: 90,
  /** The random pool opens once this scripted beat has fired, so the first day and a half are all script. */
  poolOpensAfterBeat: 'pi_quick_one',
  /** Chance per look, once the gap has passed. */
  chancePerCheck: 0.3,
  /** No failure fires in the first 6 minutes of a save, except the scripted warm fridge. */
  noFailureSec: 360,
  /** No two failures within this long. */
  failureGapSec: 120,
  /** Quince's cake: the delay after a grant award, and how long the effect lasts. */
  cakeDelaySec: 20,
  cakeSec: 60,
  /** The walkthrough begins this long after her email. */
  walkthroughDelaySec: 30,
  /** The warm fridge fires at this tick of the day, at most once a day while the fridge is broken. */
  fridgeWarmTick: hourToTick(13),
  /** Nags go out at 09:00 on each of the last 2 days before a deadline. */
  nagTick: hourToTick(9),
} as const;

/** Failure numbers (design doc 6.3). */
export const FAILURES = {
  autoclave: { chancePerCycle: 0.05, safeCycles: 3, coaxChance: 0.5, engineerSec: 30, engineerFreeCalls: 1, engineerPrice: 50 },
  lostOrder: { chance: 0.08, afterOrders: 4 },
  substitution: { chance: 0.05, orderId: 'assayKitBox', lateSec: 30, freeFlasks: 2 },
  doorOpen: { extraSec: 15 },
  mysteryTube: { keepChance: 0.5, keepData: 5 },
  update: { sec: 20 },
  binFullCooldownDays: 1,
} as const;

/** Bodo and the other visitors: how long they stand at each stop. */
export const VISIT_DWELL_SEC = { cake: 10, walkthrough: 6, inspection: 4, courier: 1.5 } as const;

export type RequestStat = 'experiments' | 'splits' | 'presentations';

/** A PI request (design doc 6.3). `withinDays` counts game days. `nextDayEnd` means 18:00 the next day. */
export interface RequestDef {
  id: string;
  /** What the chip says. */
  label: string;
  needs: Array<{ stat: RequestStat; n: number }>;
  withinDays?: number;
  nextDayEnd?: boolean;
  reward: { funds?: number; data?: number; reputation: number };
  doneText: string;
  missText: string;
  missFunds: number;
}

export const REQUESTS: Record<string, RequestDef> = {
  pi_quick_one: {
    id: 'pi_quick_one',
    label: 'Run 3 experiments',
    needs: [{ stat: 'experiments', n: 3 }],
    withinDays: 1.5,
    reward: { funds: 200, reputation: 5 },
    doneText: 'Wonderful, and so quick. I told the Dean it was an afternoon.',
    missText: 'No worries, we will call it preliminary.',
    missFunds: 50,
  },
  pi_new_direction: {
    id: 'pi_new_direction',
    label: 'Do 2 splits and 2 experiments',
    needs: [
      { stat: 'splits', n: 2 },
      { stat: 'experiments', n: 2 },
    ],
    withinDays: 2,
    reward: { data: 30, reputation: 5 },
    doneText: 'A new cell line, already! I have put you in the slides.',
    missText: 'I have had a better idea anyway.',
    missFunds: 50,
  },
  pi_slides_tonight: {
    id: 'pi_slides_tonight',
    label: 'Make a presentation',
    needs: [{ stat: 'presentations', n: 1 }],
    nextDayEnd: true,
    reward: { funds: 150, reputation: 5 },
    doneText: 'Slides! Real slides! I love you all, in a professional way.',
    missText: 'I will draw it on the whiteboard.',
    missFunds: 50,
  },
};

// ---- Conditions and effects: small data objects the sim knows how to read ----

export type Condition =
  | { type: 'noRequest' }
  | { type: 'minReputation'; n: number }
  | { type: 'minPapers'; n: number }
  | { type: 'minData'; n: number }
  | { type: 'noPaperInReview' }
  | { type: 'noFlag'; key: string }
  | { type: 'minGrowing'; n: number }
  | { type: 'hasEquipment'; defId: string }
  | { type: 'minStaff'; n: number }
  | { type: 'afterTick'; tickOfDay: number }
  | { type: 'beatFired'; id: string }
  | { type: 'noContamination' }
  | { type: 'hasCulture' }
  | { type: 'noInspection' };

export type Effect =
  | { type: 'loseStock'; item: StockItem; n: number }
  | { type: 'giveStock'; item: StockItem; n: number }
  | { type: 'funds'; n: number }
  | { type: 'reputation'; n: number }
  | { type: 'data'; n: number }
  | { type: 'flag'; key: string; value: boolean | number }
  | { type: 'toast'; text: string }
  /** Adds bags of waste to the first Lab's bin. */
  | { type: 'waste'; n: number }
  /** Opens the grant named in the event's params and starts its deadline. */
  | { type: 'announceGrant' }
  /** Pays the grant named in the event's params, at its current payout percent. */
  | { type: 'awardGrant' }
  /** Taints one culture, a ready one first. */
  | { type: 'contaminate' }
  | { type: 'delayGrowth'; sec: number }
  | { type: 'benchUpdate'; sec: number }
  | { type: 'fullEnergy' }
  | { type: 'fireDrill'; standSec: number; moodSec: number }
  | { type: 'wasteRules' }
  | { type: 'visit'; visit: 'cake' | 'walkthrough' }
  | { type: 'later'; event: string; afterSec: number; params?: Record<string, string> }
  | { type: 'chance'; p: number; then: Effect[]; otherwise?: Effect[] }
  | { type: 'startInspection' };

export interface ChoiceDef {
  label: string;
  /** A reply email that follows the choice. */
  reply?: string;
  effects: Effect[];
}

export type EventGroup = 'pi' | 'failure' | 'admin' | 'grant' | 'inspection';

export interface EventDef {
  id: string;
  group: EventGroup;
  from: string;
  subject: string;
  /** Text tokens such as {grant} are filled in by the director. */
  body: string;
  /** No email: the row only runs its effects. */
  silent?: boolean;
  /** Counts for the failure rules: not in the first 6 minutes, not twice within 120 s. */
  failure?: boolean;
  needs?: Condition[];
  effects?: Effect[];
  choices?: ChoiceDef[];
  /** The request this event starts, from REQUESTS. Only one request can be active at a time. */
  request?: string;
  /** In the random pool. Weight picks among the events that can fire, cooldown is in game days. */
  pool?: { weight: number; cooldownDays: number; needs?: Condition[] };
}

const SENT_FROM = `\n\n${PI_SIGNOFF}`;

/** Where the player is told what to do for each of Quince's emails. Order is the draw order. */
export const EVENTS: Record<string, EventDef> = {
  // ---- PI events ----
  pi_welcome: {
    id: 'pi_welcome',
    group: 'pi',
    from: PI_NAME,
    subject: 'Welcome to the team!',
    body: 'Welcome to the team! The lab is small but it has character. The fridge has the most character. Do great things.',
  },
  pi_quick_one: {
    id: 'pi_quick_one',
    group: 'pi',
    from: PI_NAME,
    subject: 'Just a quick one',
    body: 'Quick idea from the airport. Could you run three little experiments before lab meeting? Should only take an afternoon.',
    request: 'pi_quick_one',
    needs: [{ type: 'noRequest' }],
    pool: { weight: 3, cooldownDays: 3, needs: [{ type: 'beatFired', id: 'pi_quick_one' }] },
  },
  pi_new_direction: {
    id: 'pi_new_direction',
    group: 'pi',
    from: PI_NAME,
    subject: 'A thought in the shower',
    body: 'I had a thought in the shower. What if we did all of it again, but in a different cell line?',
    request: 'pi_new_direction',
    needs: [{ type: 'noRequest' }, { type: 'minPapers', n: 1 }],
    pool: { weight: 3, cooldownDays: 3 },
  },
  pi_one_more_panel: {
    id: 'pi_one_more_panel',
    group: 'pi',
    from: PI_NAME,
    subject: 'Figure 3',
    body: 'Figure 3 looks lonely. One more panel?\n\nIf yes, the next paper costs 60 Data and earns +15 Reputation instead of +10.',
    needs: [{ type: 'minData', n: 30 }, { type: 'noPaperInReview' }, { type: 'noFlag', key: 'onePanel' }],
    choices: [
      {
        label: 'Yes, one more panel',
        reply: 'Wonderful. I knew you would. I have already told people it exists.',
        effects: [
          { type: 'flag', key: 'onePanel', value: true },
          { type: 'toast', text: 'The next paper costs 60 Data and earns more Reputation' },
        ],
      },
      { label: 'Not this time', reply: 'Brave!', effects: [] },
    ],
    pool: { weight: 2, cooldownDays: 3 },
  },
  pi_slides_tonight: {
    id: 'pi_slides_tonight',
    group: 'pi',
    from: PI_NAME,
    subject: 'Slides tonight?',
    body: 'I am presenting your data tomorrow. Do we have slides? We need slides.',
    request: 'pi_slides_tonight',
    needs: [{ type: 'noRequest' }],
    pool: { weight: 2, cooldownDays: 4, needs: [{ type: 'beatFired', id: 'pi_slides_tonight' }, { type: 'afterTick', tickOfDay: hourToTick(14) }] },
  },
  pi_cake: {
    id: 'pi_cake',
    group: 'pi',
    from: PI_NAME,
    subject: 'Cake in the corridor',
    body: 'Cake in the corridor. I said we would get it. I always said that.',
    effects: [{ type: 'visit', visit: 'cake' }],
  },
  pi_walkthrough: {
    id: 'pi_walkthrough',
    group: 'pi',
    from: PI_NAME,
    subject: 'Collaborator visit at 3',
    body: 'I am showing a very important collaborator around at 3. Please look busy.',
    needs: [{ type: 'minReputation', n: 20 }],
    effects: [{ type: 'later', event: 'pi_walkthrough_start', afterSec: DIRECTOR.walkthroughDelaySec }],
    pool: { weight: 2, cooldownDays: 4 },
  },
  pi_walkthrough_start: {
    id: 'pi_walkthrough_start',
    group: 'pi',
    from: PI_NAME,
    subject: '',
    body: '',
    silent: true,
    effects: [{ type: 'visit', visit: 'walkthrough' }],
  },
  pi_what_project: {
    id: 'pi_what_project',
    group: 'pi',
    from: PI_NAME,
    subject: 'Quick question',
    body: 'Remind me, which project are you on again?',
    choices: [
      { label: 'The one in your last three emails', reply: 'Ah, that one. Excellent taste.', effects: [{ type: 'reputation', n: 1 }] },
      { label: 'The good one', reply: 'That one! I knew it.', effects: [{ type: 'reputation', n: 1 }] },
    ],
    pool: { weight: 2, cooldownDays: 3 },
  },

  // ---- Failures ----
  fail_fridge_warm: {
    id: 'fail_fridge_warm',
    group: 'failure',
    from: LAB_NAME,
    subject: 'The fridge is warm again',
    body: 'The fridge is warm again. One bottle of media has gone cloudy. It is looking at you.',
    effects: [{ type: 'loseStock', item: 'media', n: 1 }],
  },
  fail_contamination: {
    id: 'fail_contamination',
    group: 'failure',
    from: LAB_NAME,
    subject: 'Something is growing in the incubator',
    body: 'Something is growing in flask 2. It is not your cells. It seems happy.\n\nBin it at the incubator.',
    needs: [{ type: 'noContamination' }, { type: 'hasCulture' }],
    effects: [{ type: 'contaminate' }],
  },
  fail_autoclave: {
    id: 'fail_autoclave',
    group: 'failure',
    from: LAB_NAME,
    subject: 'The autoclave has gone quiet',
    body: 'The autoclave has made a noise. Then a different noise. Now it is silent, which is worse.\n\nCoax it at the autoclave (50% chance), or call the engineer from any desk. The sink still works.',
  },
  fail_lost_order: {
    id: 'fail_lost_order',
    group: 'failure',
    from: BODO_NAME,
    subject: 'Your order has been delivered',
    body: 'Your order has been delivered. To a building. The tracking page is confident it is a building.\n\nThe box is on the corridor floor with a question mark over it. Walk to it to pick it up.',
  },
  fail_substitution: {
    id: 'fail_substitution',
    group: 'failure',
    from: BODO_NAME,
    subject: 'A small substitution',
    body: 'They were out of assay kits. They sent 500 boxes of pipette tips instead. The kits follow shortly.\n\nThe kits are 30 s late. Two clean flasks came with the apology parcel.',
    effects: [{ type: 'giveStock', item: 'cleanFlasks', n: FAILURES.substitution.freeFlasks }],
  },
  fail_door_open: {
    id: 'fail_door_open',
    group: 'failure',
    from: LAB_NAME,
    subject: 'The incubator door',
    body: 'Someone left the incubator door open. The log says it was you.\n\nGrowing cultures take 15 s longer.',
    failure: true,
    needs: [{ type: 'minGrowing', n: 2 }],
    effects: [{ type: 'delayGrowth', sec: FAILURES.doorOpen.extraSec }],
    pool: { weight: 2, cooldownDays: 2 },
  },
  fail_mystery_tube: {
    id: 'fail_mystery_tube',
    group: 'failure',
    from: LAB_NAME,
    subject: 'A tube in the fridge',
    body: "You find a tube in the fridge. The label says '2'. Nothing else.",
    failure: true,
    choices: [
      {
        label: 'Keep it',
        effects: [
          {
            type: 'chance',
            p: FAILURES.mysteryTube.keepChance,
            then: [
              { type: 'data', n: FAILURES.mysteryTube.keepData },
              { type: 'toast', text: `It was the missing control. +${FAILURES.mysteryTube.keepData} Data` },
            ],
            otherwise: [{ type: 'toast', text: 'It stays a mystery. The label is still just "2"' }],
          },
        ],
      },
      { label: 'Bin it', effects: [{ type: 'waste', n: 1 }, { type: 'toast', text: 'Binned. Clear conscience, one more bag of waste' }] },
    ],
    pool: { weight: 2, cooldownDays: 2, needs: [{ type: 'hasEquipment', defId: 'fridge' }] },
  },
  fail_bin_full: {
    id: 'fail_bin_full',
    group: 'failure',
    from: LAB_NAME,
    subject: 'The waste bin is a monument',
    body: 'The waste bin is now a monument. Experiments in this room are paused until someone takes it out.',
  },
  fail_update: {
    id: 'fail_update',
    group: 'failure',
    from: LAB_NAME,
    subject: 'The bench computer wants updates',
    body: 'The bench computer wants to install updates. 1 of 47.\n\nOne bench is out of use for 20 s.',
    failure: true,
    needs: [{ type: 'hasEquipment', defId: 'bench' }],
    effects: [{ type: 'benchUpdate', sec: FAILURES.update.sec }],
    pool: { weight: 2, cooldownDays: 2 },
  },

  // ---- Admin, inspections and deadlines ----
  insp_notice: {
    id: 'insp_notice',
    group: 'inspection',
    from: TOCK_NAME,
    subject: 'Routine inspection tomorrow, 11:00',
    body: 'Routine gene-technology inspection tomorrow at 11:00. Please have your logbook signed, your waste in order and your surfaces wiped.\n\nKind regards, P. Tock\n\nThe checklist is on your screen. Sign the logbook at the desk.',
    needs: [{ type: 'noInspection' }],
    effects: [{ type: 'startInspection' }],
  },
  insp_visit: {
    id: 'insp_visit',
    group: 'inspection',
    from: TOCK_NAME,
    subject: 'Inspection report',
    body: '{report}',
  },
  admin_waste_rules: {
    id: 'admin_waste_rules',
    group: 'admin',
    from: FACILITIES_NAME,
    subject: 'A new bin colour',
    body: 'Facilities has introduced a new bin colour. Nobody knows what goes in it. Please use it correctly.\n\nTaking out waste takes 3 s longer until 18:00.',
    effects: [{ type: 'wasteRules' }],
    pool: { weight: 1, cooldownDays: 5, needs: [{ type: 'beatFired', id: 'admin_waste_rules' }] },
  },
  admin_waste_rules_end: {
    id: 'admin_waste_rules_end',
    group: 'admin',
    from: FACILITIES_NAME,
    subject: 'Memo withdrawn',
    body: 'The memo has been withdrawn.',
  },
  admin_fire_test: {
    id: 'admin_fire_test',
    group: 'admin',
    from: FACILITIES_NAME,
    subject: 'Fire alarm test',
    body: 'This is a test of the fire alarm. It is always a test.\n\nEveryone to the entrance, please. Bring ice.',
    effects: [{ type: 'fireDrill', standSec: 15, moodSec: 30 }],
    pool: { weight: 1, cooldownDays: 5, needs: [{ type: 'beatFired', id: 'admin_fire_test' }, { type: 'minStaff', n: 1 }] },
  },
  admin_seminar_pizza: {
    id: 'admin_seminar_pizza',
    group: 'admin',
    from: FACILITIES_NAME,
    subject: 'Seminar in room 3',
    body: 'Seminar in room 3. There is pizza. The seminar is optional. The pizza is not.\n\nEveryone is back at full Energy.',
    effects: [{ type: 'fullEnergy' }],
    pool: { weight: 1, cooldownDays: 3, needs: [{ type: 'minStaff', n: 1 }] },
  },
  grant_announce: {
    id: 'grant_announce',
    group: 'grant',
    from: PI_NAME,
    subject: 'A call is open: {grant}',
    body: 'A call is open: the {grant}. {need}. {deadline}Plenty of time!',
    effects: [{ type: 'announceGrant' }],
  },
  grant_nag: {
    id: 'grant_nag',
    group: 'grant',
    from: PI_NAME,
    subject: 'How is the application?',
    body: 'How is the application? No pressure. I have told the Dean it is basically submitted.',
  },
  grant_portal_crash: {
    id: 'grant_portal_crash',
    group: 'grant',
    from: 'Submission portal',
    subject: 'High demand',
    body: "The submission portal is 'experiencing high demand'. The deadline has moved to tomorrow. So has everyone's weekend.\n\nThe {grant} deadline is now Day {day} at 17:00. The payout is {percent}% of the full amount.",
  },
  grant_award: {
    id: 'grant_award',
    group: 'grant',
    from: '{funder}',
    subject: '{grant}: decision',
    body: 'We are pleased to inform you. (The rest of the email is three pages about reporting duties.)\n\n{grant} awarded. +{pays} Funds, +{rep} Reputation.',
    effects: [{ type: 'awardGrant' }, { type: 'later', event: 'pi_cake', afterSec: DIRECTOR.cakeDelaySec }],
  },
};

/** The order events are looked at in, for a stable draw. */
export const EVENT_IDS: readonly string[] = Object.keys(EVENTS);

/** Quince's emails end with her sign-off. */
export function withSignoff(def: EventDef, body: string): string {
  return def.from === PI_NAME ? `${body}${SENT_FROM}` : body;
}

/** A scripted beat (design doc 6.5). Beats that cannot fire wait until they can. */
export interface ScriptedBeat {
  /** Unique, kept in `director.firedBeats`. Recurring beats get the day added. */
  key: string;
  event: string;
  day: number;
  hour: number;
  everyDays?: number;
  params?: Record<string, string>;
}

export const SCRIPTED_BEATS: readonly ScriptedBeat[] = [
  { key: 'pi_quick_one', event: 'pi_quick_one', day: 2, hour: 9 },
  { key: 'grant_announce_equipment', event: 'grant_announce', day: 3, hour: 9, params: { grantId: 'equipment' } },
  { key: 'fail_contamination', event: 'fail_contamination', day: 4, hour: 10 },
  { key: 'insp_notice', event: 'insp_notice', day: 5, hour: 13, everyDays: 8 },
  { key: 'grant_announce_foundation', event: 'grant_announce', day: 6, hour: 9, params: { grantId: 'foundation' } },
  { key: 'pi_slides_tonight', event: 'pi_slides_tonight', day: 6, hour: 14 },
  { key: 'admin_waste_rules', event: 'admin_waste_rules', day: 7, hour: 9 },
  { key: 'admin_fire_test', event: 'admin_fire_test', day: 7, hour: 14 },
];

/** The inspection visit (design doc 6.3). The notice says tomorrow at 11:00. */
export const INSPECTION = {
  visitHour: 11,
  visitTick: hourToTick(11),
  /** Per check passed. */
  passFunds: 50,
  passReputation: 2,
  /** All four passed. */
  allReputation: 5,
  passLine: 'Tock nods. A sticker is applied.',
  missLine: 'Tock writes for quite a long time.',
  /** Clean rooms count at this Cleanliness. */
  cleanAtLeast: 60,
  checks: [
    { id: 'logbook', label: 'Logbook signed', fix: 'Sign the logbook at the desk' },
    { id: 'waste', label: 'No waste bin full', fix: 'Take out the waste' },
    { id: 'clean', label: 'Every room at Cleanliness 60 or more', fix: 'Tidy up the dirty rooms' },
    { id: 'fridge', label: 'No broken fridge', fix: 'Repair the fridge' },
  ],
  signLogbookSec: 3,
} as const;

/** Walkthrough: Quince and a guest tour the Lab. */
export const WALKTHROUGH = { cleanAtLeast: 60, reputation: 3, cleanText: 'The collaborator was impressed. +3 Reputation', messyText: 'Charmingly lived-in.' } as const;

/** The cake and the fire drill. */
export const FIRE_DRILL = { moodBonus: 5 } as const;

/** The cake sits on this corridor tile, outside the starting Lab's door. */
export const CAKE_SPOT = { x: 6, y: 10 } as const;
