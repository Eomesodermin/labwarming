import { PAPER } from '../../content/economy';
import { REVIEWER_AFTER_REVISION, REVIEWER_FIRST_ACCEPT, REVIEWER_FIRST_REVISION, REVIEWER_RANDOM } from '../../content/reviewer';
import { REVIEWER_NAME } from '../../content/events';
import { sendEmail } from '../email';
import { chance, nextInt } from '../rng';
import type { SimEvent } from '../simEvents';
import type { GameState, Paper } from '../types';
import { secondsToTicks } from '../ticks';

function randomLine(state: GameState): string {
  return REVIEWER_RANDOM[nextInt(state, REVIEWER_RANDOM.length)] ?? REVIEWER_RANDOM[0] ?? '';
}

export function acceptedPapers(state: GameState): number {
  return state.papers.filter((p) => p.status === 'accepted').length;
}

/** A paper is accepted: it pays and the letter says so. */
function accept(state: GameState, paper: Paper, line: string, events: SimEvent[]): void {
  paper.status = 'accepted';
  state.funds += PAPER.acceptFunds;
  state.reputation += PAPER.acceptReputation;
  sendEmail(
    state,
    {
      kind: 'paper_accepted',
      from: REVIEWER_NAME,
      subject: `Paper ${paper.number}: accepted`,
      body: `${line}\n\nPaper ${paper.number} is accepted. +${PAPER.acceptFunds} Funds, +${PAPER.acceptReputation} Reputation.`,
    },
    events,
  );
  events.push({ type: 'PaperReviewed', paperId: paper.id, status: 'accepted' });
  events.push({ type: 'Toast', text: `Paper ${paper.number} accepted! +${PAPER.acceptFunds} Funds` });
}

function askForRevision(state: GameState, paper: Paper, line: string, events: SimEvent[]): void {
  paper.status = 'revise';
  sendEmail(
    state,
    {
      kind: 'paper_revise',
      from: REVIEWER_NAME,
      subject: `Paper ${paper.number}: minor revision`,
      body: `${line}\n\nPaper ${paper.number} needs a minor revision. Revise it at the desk (${PAPER.reviseData} Data).`,
    },
    events,
  );
  events.push({ type: 'PaperReviewed', paperId: paper.id, status: 'revise' });
  events.push({ type: 'Toast', text: `Paper ${paper.number} needs a revision. Check your inbox` });
}

/** Writing finished at the desk: the paper goes to review. */
export function submitPaper(state: GameState): Paper {
  state.stats.papersWritten += 1;
  const paper: Paper = {
    id: `p${state.nextId++}`,
    number: state.stats.papersWritten,
    status: 'review',
    reviewTicksLeft: secondsToTicks(PAPER.reviewSec),
  };
  state.papers.push(paper);
  return paper;
}

/** The revision is done: the paper is then always accepted. */
export function acceptRevision(state: GameState, paper: Paper, events: SimEvent[]): void {
  accept(state, paper, REVIEWER_AFTER_REVISION, events);
}

/** Papers in review count down. At zero Reviewer 2 writes back (design doc 5.5). */
export function papersSystem(state: GameState, events: SimEvent[]): void {
  for (const paper of state.papers) {
    if (paper.status !== 'review') continue;
    paper.reviewTicksLeft -= 1;
    if (paper.reviewTicksLeft > 0) continue;
    paper.reviewTicksLeft = 0;
    if (paper.number === 1) accept(state, paper, REVIEWER_FIRST_ACCEPT, events);
    else if (paper.number === 2) askForRevision(state, paper, REVIEWER_FIRST_REVISION, events);
    else if (chance(state, PAPER.acceptChance)) accept(state, paper, randomLine(state), events);
    else askForRevision(state, paper, randomLine(state), events);
  }
}
