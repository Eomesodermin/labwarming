import type { GameHost } from '../host';
import { stationPrompt } from '../sim/selectors';

/** The prompt at the bottom of the screen: "E: Split cells", or the reason it cannot be done. */
export function mountStationPrompt(root: HTMLElement, host: GameHost): void {
  const el = document.createElement('div');
  el.className = 'prompt';
  el.hidden = true;
  el.setAttribute('role', 'status');
  root.appendChild(el);

  const esc = (t: string): string => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
  let last = '';
  const refresh = (): void => {
    const p = stationPrompt(host.state);
    if (!p) {
      if (!el.hidden) el.hidden = true;
      last = '';
      return;
    }
    const lines = p.options.map((o) =>
      o.reason
        ? `<div class="prompt__line prompt__line--blocked"><kbd>${o.key}</kbd> ${esc(o.name)} <span class="prompt__reason">${esc(o.reason)}</span></div>`
        : `<div class="prompt__line"><kbd>${o.key}</kbd> ${esc(o.name)}</div>`,
    );
    if (p.options.length === 0) lines.push('<div class="prompt__line prompt__line--blocked">Nothing to do here yet</div>');
    let work = '';
    if (p.working) {
      work = `<div class="prompt__work">${esc(p.working.jobName)}: press <kbd>E</kbd> in the green zone for a bonus. <kbd>Esc</kbd> to stop.</div>`;
    }
    const html = `<div class="prompt__title">${esc(p.stationName)}${p.info ? ` <span class="prompt__info">${esc(p.info)}</span>` : ''}</div>${lines.join('')}${work}`;
    if (html !== last) {
      el.innerHTML = html;
      last = html;
    }
    el.hidden = false;
  };
  refresh();
  setInterval(refresh, 100);
}
