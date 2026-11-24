import type { GameHost } from '../host';
import { emailRequestStatus } from '../sim/chips';
import { button, el, esc } from './dom';
import { openModal } from './modal';

const dayTime = (day: number, tickOfDay: number): string => {
  const mins = Math.floor((tickOfDay * 600) / 2400);
  const h = 8 + Math.floor(mins / 60);
  const m = mins % 60;
  return `Day ${day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * The inbox: a list of emails and a reading pane. Opening an email marks it read. Emails that ask
 * a question show their answers as buttons, and emails that start a PI request show a request chip.
 */
export function openInbox(root: HTMLElement, host: GameHost): void {
  const modal = openModal(root, host, { title: 'Inbox', wide: true });
  const wrap = el('div', 'inbox');
  const list = el('div', 'inbox__list');
  const reader = el('div', 'inbox__reader');
  wrap.append(list, reader);
  modal.body.appendChild(wrap);

  const mails = [...host.state.inbox].reverse();
  // Open on the first email that needs an answer, else the first unread one, else the newest.
  let selected = (mails.find((m) => m.choices && m.chosen === undefined) ?? mails.find((m) => !m.read) ?? mails[0])?.id ?? '';
  let last = '';

  const render = (): void => {
    const state = host.state;
    const inbox = [...state.inbox].reverse();
    const sel = state.inbox.find((m) => m.id === selected);
    if (sel && !sel.read) host.send({ type: 'MarkEmailRead', emailId: sel.id });
    const key = JSON.stringify([selected, inbox.map((m) => [m.id, m.read, m.chosen]), sel ? emailRequestStatus(state, sel.kind, sel.id) : null]);
    if (key === last) return;
    last = key;

    list.innerHTML = '';
    if (inbox.length === 0) list.appendChild(el('div', 'inbox__empty', 'No emails yet.'));
    for (const m of inbox) {
      const asks = m.choices !== undefined && m.chosen === undefined;
      const row = el('button', `inbox__row${m.id === selected ? ' inbox__row--on' : ''}${m.read ? '' : ' inbox__row--unread'}`);
      row.type = 'button';
      row.innerHTML = `<span class="inbox__from">${esc(m.from)}${asks ? ' <span class="inbox__ask">needs an answer</span>' : ''}</span><span class="inbox__subject">${esc(m.subject)}</span><span class="inbox__when">${dayTime(m.day, m.tickOfDay)}</span>`;
      row.addEventListener('click', () => {
        selected = m.id;
        render();
      });
      list.appendChild(row);
    }
    if (!sel) {
      reader.innerHTML = '<div class="inbox__empty">Pick an email to read it.</div>';
      return;
    }
    reader.innerHTML = `<div class="inbox__meta">From <b>${esc(sel.from)}</b> &middot; ${dayTime(sel.day, sel.tickOfDay)}</div><h3 class="inbox__head">${esc(sel.subject)}</h3><div class="inbox__text">${esc(sel.body)}</div>`;
    const status = emailRequestStatus(state, sel.kind, sel.id);
    if (status) reader.appendChild(el('div', `reqchip reqchip--${status.tone}`, esc(status.text)));
    if (sel.choices) {
      const box = el('div', 'inbox__choices');
      if (sel.chosen === undefined) {
        sel.choices.forEach((label, i) => {
          box.appendChild(
            button(label, 'btn btn--primary inbox__choice', () => {
              host.send({ type: 'ChooseEventOption', emailId: sel.id, option: i });
            }),
          );
        });
      } else {
        box.appendChild(el('div', 'inbox__chose', `You answered: ${esc(sel.choices[sel.chosen] ?? '')}`));
      }
      reader.appendChild(box);
    }
  };
  render();
  // Commands are handled a moment later, so redraw to show a marked-read email or a new answer.
  const t = setInterval(() => {
    if (!modal.el.isConnected) return clearInterval(t);
    render();
  }, 250);
}
