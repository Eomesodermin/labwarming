import { GRANTS, grantDef, type GrantDef } from '../../content/economy';
import { EVENT_ROWS } from '../../content/events';
import { sendEmail } from '../email';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';
import { acceptedPapers } from './papers';
import { secondsToTicks } from '../ticks';

/** The first grant that has not been applied for yet, or null. */
export function openGrant(state: GameState): GrantDef | null {
  return GRANTS.find((g) => !state.grants[g.id]) ?? null;
}

/** Why the player cannot write this grant yet, or null if they can. */
export function grantBlocker(state: GameState): string | null {
  const g = openGrant(state);
  if (!g) return 'Every open grant has an application in';
  const have = acceptedPapers(state);
  if (have < g.papers) return `${g.name} needs ${g.papers} accepted paper${g.papers === 1 ? '' : 's'}`;
  if (state.presentations < g.presentations) return `${g.name} needs ${g.presentations} presentation${g.presentations === 1 ? '' : 's'}`;
  return null;
}

/** The application is sent. The decision follows after the grant's decision time. */
export function applyForGrant(state: GameState, grant: GrantDef, events: SimEvent[]): void {
  state.grants[grant.id] = { status: 'applied', decisionTicksLeft: secondsToTicks(grant.decisionSec) };
  events.push({ type: 'Toast', text: `${grant.name} application sent` });
}

/** Applications count down. Every application succeeds in v1 (design doc 5.4). */
export function grantsSystem(state: GameState, events: SimEvent[]): void {
  for (const [id, prog] of Object.entries(state.grants)) {
    if (prog.status !== 'applied') continue;
    prog.decisionTicksLeft -= 1;
    if (prog.decisionTicksLeft > 0) continue;
    const def = grantDef(id);
    prog.status = 'awarded';
    prog.decisionTicksLeft = 0;
    if (!def) continue;
    state.funds += def.pays;
    state.reputation += def.reputation;
    const row = EVENT_ROWS[`grant_award_${def.id}`];
    sendEmail(
      state,
      {
        kind: `grant_award_${def.id}`,
        from: row?.from ?? 'Funding office',
        subject: row?.subject ?? `${def.name}: decision`,
        body: `${row?.body ?? 'Congratulations.'}\n\n${def.name} awarded. +${def.pays} Funds, +${def.reputation} Reputation.`,
      },
      events,
    );
    events.push({ type: 'GrantAwarded', grantId: def.id });
    events.push({ type: 'Toast', text: `${def.name} awarded! +${def.pays} Funds` });
  }
}
