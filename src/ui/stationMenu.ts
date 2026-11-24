import type { GameHost } from '../host';
import { facedMenu, type MenuEntry, type StationMenu } from '../sim/selectors';
import { el, esc } from './dom';

/** The station menu: opens with E at the desk and at a broken fridge. Number keys pick an entry. */
export function mountStationMenu(root: HTMLElement, host: GameHost): void {
  let panel: HTMLElement | null = null;
  let stationId = '';
  let last = '';

  const close = (): void => {
    if (!panel) return;
    panel.remove();
    panel = null;
    window.removeEventListener('keydown', onKey);
    host.ui.blocking = Math.max(0, host.ui.blocking - 1);
    last = '';
  };

  const choose = (entry: MenuEntry): void => {
    if (entry.panel) {
      close();
      host.ui.openLab(entry.panel);
      return;
    }
    host.send(entry.command);
    // Orders keep the menu open so several boxes can be ordered. Anything else closes it.
    if (entry.command.type !== 'PlaceOrder' && entry.command.type !== 'SetAutoReorder') close();
  };

  const entriesOf = (m: StationMenu): MenuEntry[] => m.entries;

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || (e.code === 'KeyE' && !e.repeat)) {
      e.preventDefault();
      close();
      return;
    }
    const m = facedMenu(host.state);
    const n = Number(e.key);
    if (m && n >= 1 && n <= 9) {
      const entry = entriesOf(m)[n - 1];
      if (entry) {
        e.preventDefault();
        choose(entry);
      }
    }
  }

  const render = (m: StationMenu): void => {
    if (!panel) return;
    let group = '';
    const rows = m.entries
      .map((en, i) => {
        const head = en.group !== group ? `<div class="menu__group">${esc(en.group)}</div>` : '';
        group = en.group;
        const cls = en.reason ? 'menu__item menu__item--blocked' : 'menu__item';
        const reason = en.reason ? `<span class="menu__reason">${esc(en.reason)}</span>` : '';
        return `${head}<button type="button" class="${cls}" data-i="${i}"><kbd>${i + 1}</kbd><span class="menu__label">${esc(en.label)}</span><span class="menu__detail">${esc(en.detail)}</span>${reason}</button>`;
      })
      .join('');
    const html = `<div class="menu__title">${esc(m.title)}<span class="menu__funds">Funds ${host.state.funds}</span></div>${rows}<div class="menu__foot"><kbd>Esc</kbd> to close</div>`;
    if (html === last) return;
    last = html;
    panel.innerHTML = html;
    panel.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((b) => {
      b.addEventListener('click', () => {
        const entry = m.entries[Number(b.dataset['i'])];
        if (entry) choose(entry);
      });
    });
  };

  host.ui.openMenu = (): void => {
    if (panel) return;
    const m = facedMenu(host.state);
    if (!m) return;
    stationId = m.stationId;
    panel = el('div', 'menu');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', m.title);
    root.appendChild(panel);
    host.ui.blocking += 1;
    window.addEventListener('keydown', onKey);
    render(m);
  };

  host.events.on((e) => {
    if (e.type === 'StationReached') host.ui.openMenu(); // clicked a station: its menu opens on arrival
  });

  setInterval(() => {
    if (!panel) return;
    const m = facedMenu(host.state);
    if (!m || m.stationId !== stationId) close();
    else render(m);
  }, 150);
}
