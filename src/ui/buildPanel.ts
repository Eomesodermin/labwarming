import { FRIDGE_REPAIR_COST } from '../content/economy';
import { EQUIPMENT, maxTier, tierStat } from '../content/equipment';
import { PLOTS } from '../content/map';
import { ROOMS, ROOM_ORDER, roomsAllowing } from '../content/rooms';
import type { GameHost } from '../host';
import { buyPlotBlocker, pathWarnings, sellInfo, upgradeInfo } from '../sim/placement';
import type { Equipment, RoomTypeId } from '../sim/types';
import { isTypingTarget } from '../view/input/walkInput';
import { el, esc } from './dom';
import { holdPause } from './modal';

type Tab = 'rooms' | 'equipment' | 'decor';

/** Stats worth showing in the upgrade preview, with a label. */
const STAT_LABELS: Record<string, string> = {
  slots: 'Culture slots',
  growSec: 'Growth (s)',
  experimentSec: 'Experiment (s)',
  experimentData: 'Data per experiment',
  splitSec: 'Split (s)',
  contaminationMult: 'Contamination',
  capacity: 'Capacity',
  washSec: 'Wash (s)',
  speed: 'Writing speed',
  cycleSec: 'Cycle (s)',
  breakSec: 'Break (s)',
  mood: 'Mood',
};

function upgradePreview(eq: Equipment): string {
  const stats = EQUIPMENT[eq.defId]?.stats;
  if (!stats) return '';
  const rows: string[] = [];
  for (const key of Object.keys(stats)) {
    const label = STAT_LABELS[key];
    if (!label) continue;
    const now = tierStat(eq.defId, key, eq.tier);
    const next = tierStat(eq.defId, key, eq.tier + 1);
    rows.push(next !== now ? `${label} ${now} to ${next}` : `${label} ${now}`);
  }
  return rows.join(', ');
}

/** The build mode side panel (design doc 3.2). The scene draws the grid and the ghost. */
export function mountBuildPanel(root: HTMLElement, host: GameHost): void {
  const panel = el('div', 'build');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Build mode');
  root.appendChild(panel);

  let tab: Tab = 'equipment';
  let release: (() => void) | null = null;
  let last = '';
  let confirmSell: string | null = null;
  let lastSelected: string | null = null;
  const ui = host.ui;

  const leave = (): void => {
    setBuild(false);
  };

  function onKey(e: KeyboardEvent): void {
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const b = ui.build;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (b.held) b.held = null;
      else leave();
    } else if (e.code === 'KeyB' && !e.repeat) {
      e.preventDefault();
      leave();
    } else if (e.code === 'KeyR' && b.held && !e.repeat) {
      e.preventDefault();
      b.held = { ...b.held, rot: ((b.held.rot + 1) % 4) as 0 | 1 | 2 | 3 };
    }
  }

  function setBuild(on: boolean): void {
    const b = ui.build;
    if (on === b.active) return;
    if (on) {
      b.active = true;
      b.held = null;
      b.selectedEquipment = null;
      b.selectedPlot = null;
      ui.blocking += 1;
      release = holdPause(host);
      window.addEventListener('keydown', onKey);
      root.classList.add('is-building');
      panel.hidden = false;
      last = '';
      render();
    } else {
      b.active = false;
      b.held = null;
      b.hover = null;
      b.selectedEquipment = null;
      b.selectedPlot = null;
      ui.blocking = Math.max(0, ui.blocking - 1);
      release?.();
      release = null;
      window.removeEventListener('keydown', onKey);
      root.classList.remove('is-building');
      panel.hidden = true;
    }
  }
  ui.setBuild = setBuild;

  const catalogue = (cat: 'equipment' | 'decor'): string => {
    const held = ui.build.held;
    const items = Object.values(EQUIPMENT).filter((d) => d.category === cat && d.price !== null);
    const rows = items
      .map((d) => {
        const where = roomsAllowing(d.id)
          .map((r) => r.name)
          .join(', ');
        const on = held && !held.moveId && held.defId === d.id ? ' build__item--on' : '';
        return `<button type="button" class="build__item${on}" data-act="pick" data-id="${d.id}"><span class="build__name">${esc(d.name)}</span><span class="build__price">${d.price}</span><span class="build__sub">${d.w}x${d.h}. ${esc(where)}</span></button>`;
      })
      .join('');
    return `<div class="build__list">${rows}</div>`;
  };

  const roomsTab = (): string => {
    const s = host.state;
    const plotId = ui.build.selectedPlot;
    let head: string;
    if (plotId) head = `<div class="build__note">Plot ${esc(plotId.toUpperCase())} is for sale. Choose a room:</div>`;
    else head = '<div class="build__note">Click a plot that is for sale on the map, then choose a room.</div>';
    const rows = ROOM_ORDER.map((id) => {
      const r = ROOMS[id];
      const reason = plotId ? buyPlotBlocker(s, plotId, id as RoomTypeId) : null;
      const lock = !plotId ? (s.reputation < r.unlockRep ? `Needs Reputation ${r.unlockRep}` : !r.available ? r.note : '') : (reason ?? '');
      const cls = `build__item${plotId && reason ? ' build__item--blocked' : ''}`;
      const dis = plotId ? '' : ' disabled';
      const allows = r.allows.map((d) => EQUIPMENT[d]?.name ?? d).join(', ');
      return `<button type="button" class="${cls}" data-act="buy" data-id="${id}"${dis}><span class="build__name">${esc(r.name)}</span><span class="build__price">${r.cost}</span><span class="build__sub">${esc(r.note)} ${esc(allows)}</span>${lock ? `<span class="build__reason">${esc(lock)}</span>` : ''}</button>`;
    }).join('');
    return `${head}<div class="build__list">${rows}</div>`;
  };

  const selectedCard = (): string => {
    const id = ui.build.selectedEquipment;
    const eq = id ? host.state.equipment[id] : undefined;
    if (!eq) return '';
    const def = EQUIPMENT[eq.defId];
    if (!def) return '';
    if (def.price === null) {
      return `<div class="build__card"><div class="build__cardhead">${esc(def.name)}</div><div class="build__sub">Comes free with the room.</div></div>`;
    }
    const up = upgradeInfo(host.state, eq);
    const sell = sellInfo(host.state, eq);
    const tierText = `Tier ${eq.tier} of ${maxTier(eq.defId)}${eq.broken ? ', broken' : ''}`;
    const upBtn = up.hasNext
      ? `<button type="button" class="btn build__btn${up.blocker ? ' btn--off' : ''}" data-act="upgrade" data-id="${eq.id}">Upgrade ${up.price}</button>`
      : '<button type="button" class="btn build__btn btn--off" disabled>Top tier</button>';
    const repair =
      eq.broken && eq.defId === 'fridge'
        ? `<button type="button" class="btn build__btn" data-act="repair" data-id="${eq.id}">Repair ${FRIDGE_REPAIR_COST}</button>`
        : '';
    const sellText = confirmSell === eq.id ? 'Really sell?' : `Sell +${sell.refund}`;
    const sellBtn = `<button type="button" class="btn build__btn${sell.blocker ? ' btn--off' : ''}" data-act="sell" data-id="${eq.id}">${sellText}</button>`;
    const reasons = [up.hasNext ? up.blocker : null, sell.blocker].filter((r): r is string => !!r);
    return `<div class="build__card"><div class="build__cardhead">${esc(def.name)} <span class="build__sub">${tierText}</span></div><div class="build__sub">${esc(upgradePreview(eq))}</div><div class="build__btns"><button type="button" class="btn build__btn" data-act="move" data-id="${eq.id}">Move free</button>${upBtn}${repair}${sellBtn}</div>${reasons.length ? `<div class="build__reason">${esc(reasons.join('. '))}</div>` : ''}</div>`;
  };

  function render(): void {
    const s = host.state;
    const b = ui.build;
    if (b.selectedEquipment !== lastSelected) {
      confirmSell = null;
      lastSelected = b.selectedEquipment;
    }
    if (b.selectedEquipment && !s.equipment[b.selectedEquipment]) b.selectedEquipment = null;
    if (b.selectedPlot && s.plots[b.selectedPlot]?.owned) b.selectedPlot = null;
    if (b.selectedPlot) tab = 'rooms';

    const tabs = (['rooms', 'equipment', 'decor'] as const)
      .map((t) => `<button type="button" class="build__tab${t === tab ? ' build__tab--on' : ''}" data-act="tab" data-id="${t}">${t === 'rooms' ? 'Rooms' : t === 'equipment' ? 'Equipment' : 'Decor'}</button>`)
      .join('');
    const body = tab === 'rooms' ? roomsTab() : tab === 'equipment' ? catalogue('equipment') : catalogue('decor');

    let status: string;
    if (b.held) {
      const name = EQUIPMENT[b.held.defId]?.name ?? '';
      const verb = b.held.moveId ? 'Moving' : 'Placing';
      const ghost = b.hover ? (b.hint ? `<span class="build__bad">${esc(b.hint)}</span>` : '<span class="build__good">Click to place</span>') : 'Move over the map';
      status = `<div class="build__status"><b>${verb} ${esc(name)}.</b> ${ghost}<div class="build__sub"><kbd>R</kbd> or right click to rotate. <kbd>Esc</kbd> to put it down.</div></div>`;
    } else {
      status = '<div class="build__status build__sub">Click a piece to move, upgrade or sell it.</div>';
    }
    const warns = pathWarnings(s)
      .map((w) => `<div class="build__warn">${esc(w.text)}</div>`)
      .join('');
    const plots = PLOTS.filter((p) => s.plots[p.id]?.owned).length;

    const html = `<div class="build__head"><b>Build mode</b><span class="build__funds">Funds ${s.funds}</span></div>
      <div class="build__sub">${plots} of ${PLOTS.length} plots owned. Game paused.</div>
      <div class="build__tabs">${tabs}</div>
      ${selectedCard()}
      <div class="build__scroll">${body}</div>
      ${status}${warns}
      <button type="button" class="btn build__done" data-act="exit">Done <kbd>B</kbd></button>`;
    if (html === last) return;
    last = html;
    const scroll = panel.querySelector('.build__scroll');
    const top = scroll ? scroll.scrollTop : 0;
    panel.innerHTML = html;
    const again = panel.querySelector('.build__scroll');
    if (again) again.scrollTop = top;
  }

  panel.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t || (t as HTMLButtonElement).disabled) return;
    const act = t.dataset['act'];
    const id = t.dataset['id'] ?? '';
    const b = ui.build;
    switch (act) {
      case 'tab':
        tab = id as Tab;
        b.selectedPlot = null;
        break;
      case 'pick':
        b.held = { defId: id, rot: 0, moveId: null };
        b.selectedEquipment = null;
        b.selectedPlot = null;
        break;
      case 'buy':
        if (b.selectedPlot) host.send({ type: 'BuyPlot', plotId: b.selectedPlot, roomType: id as RoomTypeId });
        break;
      case 'move': {
        const eq = host.state.equipment[id];
        if (eq) b.held = { defId: eq.defId, rot: eq.rot, moveId: eq.id };
        break;
      }
      case 'upgrade':
        host.send({ type: 'UpgradeEquipment', equipmentId: id });
        break;
      case 'repair':
        host.send({ type: 'RepairEquipment', equipmentId: id });
        break;
      case 'sell':
        if (confirmSell === id) {
          host.send({ type: 'SellEquipment', equipmentId: id });
          confirmSell = null;
          b.selectedEquipment = null;
        } else confirmSell = id;
        break;
      case 'exit':
        leave();
        return;
    }
    last = '';
    render();
  });

  setInterval(() => {
    if (!ui.build.active) {
      if (!panel.hidden) setBuild(false);
      return;
    }
    // Pause is held for the whole of build mode, even if someone presses Resume.
    if (host.state.clock.speed !== 0) host.send({ type: 'SetSpeed', speed: 0 });
    render();
  }, 100);
}
