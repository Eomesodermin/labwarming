import { EVENT_ROWS } from '../content/events';
import type { SimEvent } from './simEvents';
import type { Email, GameState } from './types';

export function sendEmail(
  state: GameState,
  fields: { kind: string; from: string; subject: string; body: string },
  events?: SimEvent[],
): Email {
  const mail: Email = {
    id: `m${state.nextId++}`,
    ...fields,
    day: state.clock.day,
    tickOfDay: state.clock.tickOfDay,
    read: false,
  };
  state.inbox.push(mail);
  events?.push({ type: 'EmailReceived', emailId: mail.id, kind: mail.kind, subject: mail.subject });
  return mail;
}

/** Sends the email from a content row in `content/events.ts`. */
export function sendEmailRow(state: GameState, rowId: string, events?: SimEvent[]): Email | null {
  const row = EVENT_ROWS[rowId];
  if (!row) return null;
  return sendEmail(state, { kind: row.id, from: row.from, subject: row.subject, body: row.body }, events);
}
