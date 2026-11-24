import { CRASH_PAY_PERCENT, GRANTS, DEADLINE_HOUR, grantDef, type GrantDef } from '../../content/economy';
import { hourToTick } from '../../content/events';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';
import { acceptedPapers } from './papers';
import { secondsToTicks } from '../ticks';
import { fireEvent } from './eventCore';

/** Grants that are open and have no application yet. */
export function openGrants(state: GameState): GrantDef[] {
  return GRANTS.filter((g) => state.grantCalls[g.id]?.announced === true && !state.grants[g.id]);
}

/** Why this grant cannot be written yet, or null. */
function needBlocker(state: GameState, g: GrantDef): string | null {
  const have = acceptedPapers(state);
  if (have < g.papers) return `${g.name} needs ${g.papers} accepted paper${g.papers === 1 ? '' : 's'}`;
  if (state.presentations < g.presentations) return `${g.name} needs ${g.presentations} presentation${g.presentations === 1 ? '' : 's'}`;
  if (state.reputation < g.minReputation) return `${g.name} needs Reputation ${g.minReputation}`;
  return null;
}

/** The grant the desk would write now: the open grant with the soonest deadline whose needs are met. */
export function openGrant(state: GameState): GrantDef | null {
  const ready = openGrants(state).filter((g) => needBlocker(state, g) === null);
  ready.sort((a, b) => (state.grantCalls[a.id]?.deadlineDay ?? 1e9) - (state.grantCalls[b.id]?.deadlineDay ?? 1e9));
  return ready[0] ?? null;
}

/** Why the player cannot write a grant yet, or null if they can. */
export function grantBlocker(state: GameState): string | null {
  if (openGrant(state)) return null;
  const open = openGrants(state);
  const first = open[0];
  if (!first) return 'Every open grant has an application in';
  return needBlocker(state, first);
}

/** The application is sent. The decision follows after the grant's decision time. */
export function applyForGrant(state: GameState, grant: GrantDef, events: SimEvent[]): void {
  state.grants[grant.id] = { status: 'applied', decisionTicksLeft: secondsToTicks(grant.decisionSec) };
  events.push({ type: 'Toast', text: `${grant.name} application sent` });
}

/**
 * Applications count down (every application succeeds in v1, design doc 5.4). An open grant
 * whose deadline passes with no application "crashes the portal": the deadline moves one day
 * and the payout drops to 80 percent. A grant can never be lost.
 */
export function grantsSystem(state: GameState, events: SimEvent[]): void {
  for (const [id, prog] of Object.entries(state.grants)) {
    if (prog.status !== 'applied') continue;
    prog.decisionTicksLeft -= 1;
    if (prog.decisionTicksLeft > 0) continue;
    prog.status = 'awarded';
    prog.decisionTicksLeft = 0;
    const def = grantDef(id);
    if (def) fireEvent(state, 'grant_award', events, { params: { grantId: def.id } });
  }
  const { day, tickOfDay } = state.clock;
  for (const g of GRANTS) {
    const call = state.grantCalls[g.id];
    if (!call?.announced || call.deadlineDay === null || state.grants[g.id]) continue;
    const passed = day > call.deadlineDay || (day === call.deadlineDay && tickOfDay >= hourToTick(DEADLINE_HOUR));
    if (!passed) continue;
    call.deadlineDay += 1;
    call.payPercent = CRASH_PAY_PERCENT;
    call.crashes += 1;
    fireEvent(state, 'grant_portal_crash', events, { params: { grantId: g.id } });
  }
}
