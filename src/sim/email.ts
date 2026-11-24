import type { SimEvent } from './simEvents';
import type { Email, GameState } from './types';

export function sendEmail(
  state: GameState,
  fields: { kind: string; from: string; subject: string; body: string; choices?: string[] },
  events?: SimEvent[],
): Email {
  const mail: Email = {
    id: `m${state.nextId++}`,
    kind: fields.kind,
    from: fields.from,
    subject: fields.subject,
    body: fields.body,
    day: state.clock.day,
    tickOfDay: state.clock.tickOfDay,
    read: false,
  };
  if (fields.choices && fields.choices.length > 0) mail.choices = fields.choices;
  state.inbox.push(mail);
  events?.push({ type: 'EmailReceived', emailId: mail.id, kind: mail.kind, subject: mail.subject });
  return mail;
}
