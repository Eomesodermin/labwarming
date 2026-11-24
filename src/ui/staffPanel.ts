import { MAX_PER_ROLE } from '../content/staff';
import type { GameHost } from '../host';
import { hireOptions, staffRows, type HireRole, type StaffRow } from '../sim/selectors';
import { PALETTE_HEX } from '../view/art/palette';
import { el, esc } from './dom';
import { openModal } from './modal';

type Tab = 'team' | 'hire';

const swatch = (colour: keyof typeof PALETTE_HEX): string => `<span class="staff__swatch" style="background:${PALETTE_HEX[colour]}" aria-hidden="true"></span>`;

function bar(kind: 'energy' | 'mood', value: number, low: boolean): string {
  const label = kind === 'energy' ? 'Energy' : 'Mood';
  return `<div class="staff__meter${low ? ' staff__meter--low' : ''}" title="${label} ${value} of 100"><span class="staff__meterlabel">${label}</span><span class="staff__track"><span class="staff__fill staff__fill--${kind}" style="width:${value}%"></span></span><span class="staff__num">${value}</span></div>`;
}

function teamHtml(rows: StaffRow[], confirm: string | null): string {
  if (rows.length === 0) return '<p class="modal__hint">Nobody on the team yet. The Hire tab has candidates. They refresh each morning.</p>';
  return rows
    .map((r) => {
      const part =
        confirm === r.id
          ? `<button type="button" class="btn btn--danger staff__btn" data-act="part-yes" data-id="${r.id}">Sure? Part ways</button><button type="button" class="btn staff__btn" data-act="part-no">Keep</button>`
          : `<button type="button" class="btn staff__btn" data-act="part" data-id="${r.id}">Part ways</button>`;
      const status = r.onBreak ? '<span class="staff__tag staff__tag--break">On break</span>' : r.tired ? '<span class="staff__tag staff__tag--break">Needs a break</span>' : r.gloomy ? '<span class="staff__tag staff__tag--gloom">Gloomy</span>' : '';
      return `<div class="staff__card">
        <div class="staff__head">${swatch(r.colour)}<span class="staff__name">${esc(r.name)}</span><span class="staff__role">${esc(r.roleName)}</span>${status}<span class="staff__pay">${r.salary} a day</span></div>
        <div class="staff__trait"><b>${esc(r.traitName)}.</b> ${esc(r.traitText)}</div>
        <div class="staff__doing">${esc(r.doing)}</div>
        <div class="staff__meters">${bar('energy', r.energy, r.tired)}${bar('mood', r.mood, r.gloomy)}</div>
        <div class="staff__actions">${part}</div>
      </div>`;
    })
    .join('');
}

function hireHtml(roles: HireRole[], funds: number): string {
  const sections = roles.map((role) => {
    const head = `<div class="staff__rolehead"><span class="staff__rolename">${esc(role.name)}</span><span class="staff__terms">Fee ${role.fee}, ${role.salary} a day, speed ${role.speed.toFixed(1)}, ${role.hired}/${MAX_PER_ROLE} hired</span></div><div class="modal__hint staff__blurb">${esc(role.blurb)}</div>`;
    const lock = role.locked ? `<div class="staff__lock">${esc(role.locked)}</div>` : '';
    const cards = role.candidates
      .map((c) => {
        const reason = role.locked ?? c.blocker;
        const btn = reason
          ? `<button type="button" class="btn staff__btn btn--off" disabled title="${esc(reason)}">Hire for ${role.fee}</button>`
          : `<button type="button" class="btn btn--primary staff__btn" data-act="hire" data-id="${c.id}">Hire for ${role.fee}</button>`;
        const why = !role.locked && c.blocker ? `<div class="staff__why">${esc(c.blocker)}</div>` : '';
        return `<div class="staff__cand">${swatch(c.colour)}<div class="staff__candbody"><div class="staff__name">${esc(c.name)}</div><div class="staff__trait"><b>${esc(c.traitName)}.</b> ${esc(c.traitText)}</div>${why}</div>${btn}</div>`;
      })
      .join('');
    const none = role.candidates.length === 0 ? '<div class="modal__hint">Nobody left today. New faces tomorrow.</div>' : '';
    return `<section class="staff__role-section">${head}${lock}${cards}${none}</section>`;
  });
  return `<div class="staff__funds">Funds ${funds}</div>${sections.join('')}`;
}

/** The staff panel (key T): the team with their jobs, Energy and Mood, and the hire tab. Does not pause the game. */
export function openStaffPanel(root: HTMLElement, host: GameHost, startTab: Tab = 'team'): void {
  let tab: Tab = startTab;
  let confirm: string | null = null;
  let last = '';
  let timer = 0;
  let off = (): void => undefined;
  const modal = openModal(root, host, {
    title: 'Staff',
    wide: true,
    pause: false,
    onClose: () => {
      clearInterval(timer);
      off();
    },
  });
  const tabs = el('div', 'tabs');
  const content = el('div', 'staff');
  modal.body.append(tabs, content);

  const render = (): void => {
    const s = host.state;
    const rows = staffRows(s);
    if (confirm && !rows.some((r) => r.id === confirm)) confirm = null;
    const html =
      `<div class="tabs__row"><button type="button" class="btn${tab === 'team' ? ' btn--active' : ''}" data-act="tab" data-tab="team">Team (${rows.length})</button><button type="button" class="btn${tab === 'hire' ? ' btn--active' : ''}" data-act="tab" data-tab="hire">Hire</button></div>` +
      (tab === 'team' ? teamHtml(rows, confirm) : hireHtml(hireOptions(s), s.funds));
    if (html === last) return;
    last = html;
    const scroll = modal.body.scrollTop;
    content.innerHTML = html;
    modal.body.scrollTop = scroll;
  };

  content.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    const id = t.dataset['id'] ?? '';
    switch (t.dataset['act']) {
      case 'tab':
        tab = t.dataset['tab'] === 'hire' ? 'hire' : 'team';
        break;
      case 'hire':
        host.send({ type: 'HireStaff', candidateId: id });
        tab = 'team';
        break;
      case 'part':
        confirm = id;
        break;
      case 'part-yes':
        host.send({ type: 'PartWays', agentId: id });
        confirm = null;
        break;
      case 'part-no':
        confirm = null;
        break;
      default:
        return;
    }
    last = '';
    render();
  });

  timer = window.setInterval(render, 250);
  off = host.events.on((e) => {
    if (e.type === 'StaffHired' || e.type === 'StaffLeft') last = '';
  });
  render();
}
