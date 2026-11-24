import type { GameHost } from '../host';
import { el, esc } from './dom';
import { openModal } from './modal';

const dayTime = (day: number, tickOfDay: number): string => {
  const mins = Math.floor((tickOfDay * 600) / 2400);
  const h = 8 + Math.floor(mins / 60);
  const m = mins % 60;
  return `Day ${day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** The basic inbox: a list of emails and a reading pane. Opening an email marks it read. */
export function openInbox(root: HTMLElement, host: GameHost): void {
  const modal = openModal(root, host, { title: 'Inbox', wide: true });
  const wrap = el('div', 'inbox');
  const list = el('div', 'inbox__list');
  const reader = el('div', 'inbox__reader');
  wrap.append(list, reader);
  modal.body.appendChild(wrap);

  const mails = [...host.state.inbox].reverse();
  let selected = (mails.find((m) => !m.read) ?? mails[0])?.id ?? '';

  const render = (): void => {
    const inbox = [...host.state.inbox].reverse();
    list.innerHTML = '';
    if (inbox.length === 0) list.appendChild(el('div', 'inbox__empty', 'No emails yet.'));
    for (const m of inbox) {
      const row = el('button', `inbox__row${m.id === selected ? ' inbox__row--on' : ''}${m.read ? '' : ' inbox__row--unread'}`);
      row.type = 'button';
      row.innerHTML = `<span class="inbox__from">${esc(m.from)}</span><span class="inbox__subject">${esc(m.subject)}</span><span class="inbox__when">${dayTime(m.day, m.tickOfDay)}</span>`;
      row.addEventListener('click', () => {
        selected = m.id;
        render();
      });
      list.appendChild(row);
    }
    const sel = host.state.inbox.find((m) => m.id === selected);
    if (!sel) {
      reader.innerHTML = '<div class="inbox__empty">Pick an email to read it.</div>';
      return;
    }
    if (!sel.read) host.send({ type: 'MarkEmailRead', emailId: sel.id });
    reader.innerHTML = `<div class="inbox__meta">From <b>${esc(sel.from)}</b> &middot; ${dayTime(sel.day, sel.tickOfDay)}</div><h3 class="inbox__head">${esc(sel.subject)}</h3><div class="inbox__text">${esc(sel.body)}</div>`;
  };
  render();
  // Marking read happens one tick later, so redraw once to drop the unread style.
  const t = setInterval(() => {
    if (!modal.el.isConnected) return clearInterval(t);
    render();
  }, 400);
}
