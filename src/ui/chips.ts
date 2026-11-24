import type { GameHost } from '../host';
import { chips, inspectionNote } from '../sim/chips';
import { el, esc } from './dom';

/**
 * The chips under the top bar: PI requests with their progress, grant countdowns, and the
 * inspection. While an inspection is coming, a sticky checklist shows below them, and after
 * the visit it shows Tock's notes until each one is fixed.
 */
export function mountChips(root: HTMLElement, host: GameHost): void {
  const tray = el('div', 'chips');
  tray.setAttribute('aria-label', 'Requests and deadlines');
  root.appendChild(tray);
  let last = '';

  const refresh = (): void => {
    const s = host.state;
    const list = chips(s);
    const note = inspectionNote(s);
    const chipHtml = list
      .map((c) => `<div class="chip2 chip2--${c.kind} chip2--${c.tone}"><b>${esc(c.label)}</b><span>${esc(c.detail)}</span></div>`)
      .join('');
    const noteHtml = note
      ? `<div class="checklist${note.after ? ' checklist--notes' : ''}"><div class="checklist__title">${esc(note.title)}</div><ul>${note.rows
          .map((r) => `<li class="${r.ok ? 'checklist__ok' : 'checklist__todo'}"><span class="checklist__box">${r.ok ? '&#10003;' : ''}</span><span>${esc(r.ok ? r.label : note.after ? r.fix : `${r.label}`)}${!r.ok && !note.after ? `<small>${esc(r.fix)}</small>` : ''}</span></li>`)
          .join('')}</ul></div>`
      : '';
    const html = chipHtml + noteHtml;
    if (html === last) return;
    last = html;
    tray.innerHTML = html;
  };
  refresh();
  setInterval(refresh, 250);
}
