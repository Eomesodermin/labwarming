// Money, papers and grants (design doc 5). Change numbers here, not in the systems.

export const STARTING_FUNDS = 500;
export const STARTING_REPUTATION = 0;

/** Core funding, paid at the end of each day (18:00). */
export const CORE_FUNDING = 100;

/** What it costs to repair the starting fridge. Pacing table, minute 3. */
export const FRIDGE_REPAIR_COST = 150;

export const PAPER = {
  /** Data used, desk seconds, and how long the review takes. */
  data: 100,
  writeSec: 20,
  reviewSec: 40,
  /** Paper 1 is always accepted, paper 2 always needs a revision. From paper 3 on, this chance of outright acceptance. */
  acceptChance: 0.6,
  acceptFunds: 250,
  acceptReputation: 10,
  reviseData: 20,
  reviseSec: 8,
  /** After saying yes to "one more panel" (design doc 6.3). */
  panelData: 120,
  panelReputation: 15,
} as const;

export const PRESENTATION = { data: 40, sec: 12, reputation: 8 } as const;

export const GRANT_WRITE_SEC = 20;

export interface GrantDef {
  id: string;
  name: string;
  /** Who writes the decision email. */
  funder: string;
  /** What the announcement email says it needs, in words. */
  needText: string;
  /** Accepted papers needed. */
  papers: number;
  presentations: number;
  /** Reputation needed to apply. */
  minReputation: number;
  /** Funds paid on award. */
  pays: number;
  reputation: number;
  /** Seconds from sending the application to the decision. */
  decisionSec: number;
  /** The deadline, 17:00 on this day. Null means there is none. */
  deadlineDay: number | null;
}

/** The deadline falls at 17:00 (design doc 5.4). The tick of day for 17:00 is nine hours into the day. */
export const DEADLINE_HOUR = 17;
/** After a portal crash the payout is this percent of the full amount. */
export const CRASH_PAY_PERCENT = 80;

/**
 * Grants (design doc 5.4). The announcement time of each one is a scripted beat in
 * `content/events.ts`. The Seedling Grant is open from the start.
 */
export const GRANTS: readonly GrantDef[] = [
  { id: 'seedling', name: 'Seedling Grant', funder: 'Seedling Fund', needText: 'One paper', papers: 1, presentations: 0, minReputation: 0, pays: 1200, reputation: 5, decisionSec: 30, deadlineDay: null },
  { id: 'equipment', name: 'Departmental Equipment Call', funder: 'Departmental Office', needText: 'Two papers and a presentation', papers: 2, presentations: 1, minReputation: 0, pays: 2000, reputation: 5, decisionSec: 30, deadlineDay: 5 },
  { id: 'foundation', name: 'Foundation Project Grant', funder: 'Project Foundation', needText: 'Four papers and Reputation 60', papers: 4, presentations: 0, minReputation: 60, pays: 4000, reputation: 5, decisionSec: 30, deadlineDay: 10 },
];

/** Debug and test helper: the grant by id. */
export function grantDef(id: string): GrantDef | undefined {
  return GRANTS.find((g) => g.id === id);
}

/** Selling equipment returns this share of everything paid for it. */
export const SELL_REFUND = 0.5;
