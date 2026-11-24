import type { GameHost } from '../host';
import { todoList } from '../sim/selectors';

/** The sticky-note to-do list for the first six steps. It hides itself once they are all done. */
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
    if (current === -1) {
      if (allDoneAt === 0) allDoneAt = Date.now();
      note.hidden = Date.now() - allDoneAt > 9000;
    }
    const rows = items
      .map((i, idx) => {
        const cls = i.done ? 'todo__item todo__item--done' : idx === current ? 'todo__item todo__item--now' : 'todo__item';
        const hint = idx === current ? `<div class="todo__hint">${i.hint}</div>` : '';
        return `<li class="${cls}"><span class="todo__box">${i.done ? '&#10003;' : ''}</span><span>${i.text}${hint}</span></li>`;
      })
      .join('');
    const foot = current === -1 ? '<div class="todo__foot">All done. Nice lab.</div>' : '';
    const html = `<div class="todo__title">To do</div><ul>${rows}</ul>${foot}`;
    if (html !== last) {
      note.innerHTML = html;
      last = html;
    }
  };
  refresh();
  setInterval(refresh, 250);
}
