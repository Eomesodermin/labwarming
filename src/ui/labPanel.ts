import { FACILITY } from '../content/facility';
import type { GameHost } from '../host';
import { formatPlayTime } from '../platform/feedback';
import { facilityView, goalProgress, goalRows } from '../sim/selectors';
import { el, esc } from './dom';
import { openModal } from './modal';

export type LabTab = 'goals' | 'media';

/** SVG ring for the top bar and the goals tab: `done` of `total` segments filled. */
export function ringSvg(done: number, total: number, size = 22): string {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const frac = total === 0 ? 0 : done / total;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--stone)" stroke-width="3"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--moss)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

function goalsHtml(host: GameHost): string {
  const rows = goalRows(host.state);
  const p = goalProgress(host.state);
  const items = rows
    .map((r) => {
      const when = r.atSec !== null ? `<span class="goal__when">${esc(formatPlayTime(r.atSec))}</span>` : '';
      const count = r.need > 1 ? `<span class="goal__count">${r.have}/${r.need}</span>` : '';
      const hint = r.done ? '' : `<div class="goal__hint">${esc(r.hint)}</div>`;
      return `<li class="goal${r.done ? ' goal--done' : ''}"><span class="todo__box">${r.done ? '&#10003;' : ''}</span><div class="goal__body"><div class="goal__text">${esc(r.text)}${count}${when}</div>${hint}</div></li>`;
    })
    .join('');
  const foot = host.state.goals.partyDone ? '<p class="modal__hint">All five done. The party happened. The lab carries on.</p>' : '<p class="modal__hint">Tick all five and the lab throws itself a party.</p>';
  return `<div class="goals__head">${ringSvg(p.done, p.total, 44)}<div><b>Lab Warming list</b><div class="modal__hint">${p.done} of ${p.total} done</div></div></div><ul class="goals">${items}</ul>${foot}`;
}

function mediaHtml(host: GameHost): string {
  const v = facilityView(host.state);
  if (!v.open) return `<p class="modal__hint"><b>The Media Kitchen</b> makes media for you, and neighbours buy the spare.</p><div class="staff__lock">${esc(v.lockedText ?? '')}</div>`;
  const powderNote = v.powder === 0 && v.batchLeft === 0 ? '<div class="staff__why">Out of powder. Turn on auto-reorder or order a box at the desk.</div>' : '';
  return `<p class="modal__hint"><b>The Media Kitchen</b> keeps media at the target. Visitors buy spare bottles above ${FACILITY.reserve}.</p>
  <div class="media__row"><label for="media-target">Target level</label><input id="media-target" type="range" min="${v.targetMin}" max="${v.targetMax}" step="1" value="${v.target}" aria-label="Target media level"><output class="media__out">${v.target}</output></div>
  <div class="media__row"><label for="media-auto">Auto-reorder powder</label><input id="media-auto" type="checkbox" ${v.autoReorder ? 'checked' : ''}><span class="modal__hint">Orders a box when powder drops below ${FACILITY.reorderBelow}.</span></div>
  <table class="eod"><tr><th>Media in the fridge</th><td>${v.media} of ${v.target}</td></tr><tr><th>Powder</th><td>${v.powder}${v.batchLeft > 0 ? ` (+${v.batchLeft} bottles open)` : ''}</td></tr><tr><th>Technician</th><td>${esc(v.techDoing ?? 'on the way')}</td></tr><tr><th>Next visitor</th><td>${v.nextVisitorSec !== null ? `in about ${v.nextVisitorSec} s` : '-'}</td></tr><tr><th>Sold</th><td>${v.sold} bottles to ${v.visitors} visitors, +${v.earned} Funds</td></tr></table>${powderNote}`;
}

/** The Lab panel (key L): the Lab Warming list and the Media Kitchen settings. Does not pause the game. */
export function openLabPanel(root: HTMLElement, host: GameHost, startTab: LabTab = 'goals'): void {
  let tab: LabTab = startTab;
  let timer = 0;
  const modal = openModal(root, host, { title: 'Lab', wide: true, pause: false, onClose: () => clearInterval(timer) });
  const tabs = el('div', 'tabs');
  const content = el('div', 'labpanel');
  modal.body.append(tabs, content);
  let last = '';
  let dragging = false;

  const render = (): void => {
    if (dragging) return;
    const html =
      `<div class="tabs__row"><button type="button" class="btn${tab === 'goals' ? ' btn--active' : ''}" data-tab="goals">Lab Warming list</button><button type="button" class="btn${tab === 'media' ? ' btn--active' : ''}" data-tab="media">Media Kitchen</button></div>` +
      `<div class="labpanel__body">${tab === 'goals' ? goalsHtml(host) : mediaHtml(host)}</div>`;
    if (html === last) return;
    last = html;
    content.innerHTML = html;
  };
  content.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!t) return;
    tab = t.dataset['tab'] === 'media' ? 'media' : 'goals';
    last = '';
    render();
  });
  content.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'media-target') {
      dragging = true;
      const out = content.querySelector('.media__out');
      if (out) out.textContent = t.value;
      host.send({ type: 'SetMediaTarget', target: Number(t.value) });
    }
  });
  content.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'media-target') dragging = false;
    if (t.id === 'media-auto') host.send({ type: 'SetAutoReorder', on: t.checked });
    last = '';
  });
  timer = window.setInterval(render, 300);
  render();
}
