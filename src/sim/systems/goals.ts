import { GOALS, PARTY, PROMPTS, type GoalDef, type GoalId } from '../../content/facility';
import { GRANTS } from '../../content/economy';
import { TICKS_PER_SECOND } from '../../content/balance';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';
import { fireEvent } from './eventCore';
import { facilityOpen } from './facility';
import { staffAgents } from './staff';

/** How far a goal is right now: what the player has, and what the goal needs. */
export function goalValue(state: GameState, id: GoalId): number {
  switch (id) {
    case 'rooms':
      return Object.values(state.plots).filter((p) => p.owned).length;
    case 'staff':
      return new Set(staffAgents(state).map((a) => a.staff?.role)).size;
    case 'facility':
      return facilityOpen(state) ? 1 : 0;
    case 'request':
      return state.stats.requestsDone;
    case 'grant':
      // An application counts when it went in before the deadline. A portal crash moves the deadline,
      // so an application made during the extension counts too. Grants with no deadline do not count.
      return GRANTS.filter((g) => g.deadlineDay !== null && state.grants[g.id] !== undefined).length;
  }
}

export function goalMet(state: GameState, g: GoalDef): boolean {
  return goalValue(state, g.id) >= g.need;
}

/** Play time in seconds at which a goal was reached, or null. */
export function goalTimeSec(state: GameState, id: GoalId): number | null {
  const t = state.goals.reached[id];
  return t === undefined ? null : Math.round(t / TICKS_PER_SECOND);
}

export function allGoalsReached(state: GameState): boolean {
  return GOALS.every((g) => state.goals.reached[g.id] !== undefined);
}

/**
 * Ticks goals off the first time they are met (they stay ticked), plays the Lab Warming Party once
 * when all five are done, and sends the two feedback prompts once each.
 */
export function goalsSystem(state: GameState, events: SimEvent[]): void {
  const gl = state.goals;
  for (const g of GOALS) {
    if (gl.reached[g.id] !== undefined || !goalMet(state, g)) continue;
    gl.reached[g.id] = state.tick;
    events.push({ type: 'GoalReached', goalId: g.id });
    events.push({ type: 'Toast', text: `Goal reached: ${g.text}` });
  }
  if (!gl.partyDone && allGoalsReached(state)) {
    gl.partyDone = true;
    fireEvent(state, 'lab_party', events);
    events.push({ type: 'PartyStarted' });
    events.push({ type: 'Toast', text: PARTY.line });
    sendPrompt(state, 'party', events);
  }
  if (state.tick >= PROMPTS.thirtyMinSec * TICKS_PER_SECOND) sendPrompt(state, 'thirty', events);
}

function sendPrompt(state: GameState, id: 'party' | 'thirty', events: SimEvent[]): void {
  if (state.goals.prompted.includes(id)) return;
  state.goals.prompted.push(id);
  events.push({ type: 'FeedbackPrompt', reason: id });
}
