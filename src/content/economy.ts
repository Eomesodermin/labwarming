// Money, papers and grants (design doc 5). Change numbers here, not in the systems.

export const STARTING_FUNDS = 500;
export const STARTING_REPUTATION = 0;

/** Core funding, paid at the end of each day (18:00). */
export const CORE_FUNDING = 100;

/** What it costs to repair the starting fridge. Pacing table, minute 3. */
export const FRIDGE_REPAIR_COST = 150;

export const PAPER = {
  /** Data used, desk seconds, and how long the review takes. */
  data: 50,
  writeSec: 20,
  reviewSec: 40,
  /** Paper 1 is always accepted, paper 2 always needs a revision. From paper 3 on, this chance of outright acceptance. */
  acceptChance: 0.6,
  acceptFunds: 250,
  acceptReputation: 10,
  reviseData: 10,
  reviseSec: 8,
} as const;

export const PRESENTATION = { data: 20, sec: 12, reputation: 8 } as const;

export const GRANT_WRITE_SEC = 20;

export interface GrantDef {
  id: string;
  name: string;
  /** Accepted papers needed. */
  papers: number;
  presentations: number;
  /** Funds paid on award. */
  pays: number;
  reputation: number;
  /** Seconds from sending the application to the decision. */
  decisionSec: number;
}

/** Milestone 3 has only the Seedling Grant. The other grants arrive with their deadlines in milestone 6. */
export const GRANTS: readonly GrantDef[] = [
  { id: 'seedling', name: 'Seedling Grant', papers: 1, presentations: 0, pays: 1200, reputation: 5, decisionSec: 30 },
];

/** Debug and test helper: the grant by id. */
export function grantDef(id: string): GrantDef | undefined {
  return GRANTS.find((g) => g.id === id);
}
