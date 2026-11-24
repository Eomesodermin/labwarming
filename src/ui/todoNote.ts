import type { GameHost } from '../host';
import { todoList } from '../sim/selectors';
import { esc } from './dom';

/**
 * The sticky-note to-do list. It guides the first 12 minutes, through the first hire. To stay small it
 * shows the step before, the step to do now (with its hint) and the next one, and a count. It hides
 * itself a few seconds after the last step.
 */
export function mountTodoNote(root: HTMLElement, host: GameHost): void {
  const note = document.createElement('aside');
  note.className = 'todo';
  note.setAttribute('aria-label', 'To-do list');
  root.appendChild(note);
  let last = '';
  let allDoneAt = 0;

  const refresh = (): void => {
    const items = todoList(host.state);
    const current = items.findIndex((i) => !i.done);
    const doneCount = items.filter((i) => i.done).length;
    if (current === -1) {
      if (allDoneAt === 0) allDoneAt = Date.now();
      note.hidden = Date.now() - allDoneAt > 9000;
    }
    const from = current === -1 ? items.length - 1 : Math.max(0, current - 1);
    const shown = current === -1 ? [items[from]] : items.slice(from, current + 2);
    const rows = shown
      .map((i) => {
        if (!i) return '';
        const idx = items.indexOf(i);
        const cls = i.done ? 'todo__item todo__item--done' : idx === current ? 'todo__item todo__item--now' : 'todo__item';
        const hint = idx === current ? `<div class="todo__hint">${esc(i.hint)}</div>` : '';
        return `<li class="${cls}"><span class="todo__box">${i.done ? '&#10003;' : ''}</span><span>${esc(i.text)}${hint}</span></li>`;
      })
      .join('');
    const foot = current === -1 ? '<div class="todo__foot">All done. Nice lab.</div>' : '';
    const html = `<div class="todo__title">To do <span class="todo__count">${doneCount}/${items.length}</span></div><ul>${rows}</ul>${foot}`;
    if (html !== last) {
      note.innerHTML = html;
      last = html;
    }
  };
  refresh();
  setInterval(refresh, 250);
}
