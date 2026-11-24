import type { GameHost } from '../host';
import { button, el } from './dom';
import { openModal, whenFree } from './modal';

/** The end-of-day card at 18:00. The game pauses until the player continues. */
export function mountEndOfDay(root: HTMLElement, host: GameHost): void {
  host.events.on((e) => {
    if (e.type !== 'EndOfDay') return;
    const { day, funding, funds } = e;
    whenFree(() => {
      const modal = openModal(root, host, { title: `Day ${day} is done`, dismissable: false });
      const s = host.state;
      const rows = el('table', 'eod');
      const row = (label: string, value: string, cls = ''): string => `<tr class="${cls}"><th>${label}</th><td>${value}</td></tr>`;
      rows.innerHTML =
        row('Core funding', `+${funding}`, 'eod__good') +
        row('Salaries', 'none yet') +
        row('Funds', String(funds), 'eod__total') +
        row('Experiments so far', String(s.stats.experiments)) +
        row('Papers accepted', String(s.papers.filter((p) => p.status === 'accepted').length)) +
        row('Reputation', String(s.reputation));
      const go = button('Next day', 'btn btn--primary', () => modal.close());
      const actions = el('div', 'modal__actions');
      actions.appendChild(go);
      modal.body.append(el('p', 'modal__hint', 'The lab lights go down. The fridge hums on its own.'), rows, actions);
      go.focus();
    });
  });
}
