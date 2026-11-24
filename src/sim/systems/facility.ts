import { FACILITY, VISITOR_EMPTY_LINES, VISITOR_LINES } from '../../content/facility';
import { PORTRAIT_COLOURS, STAFF_NAMES, TRAIT_ORDER } from '../../content/staff';
import { mulberry32 } from '../rng';
import type { SimEvent } from '../simEvents';
import { plotOf } from '../stock';
import { secondsToTicks } from '../ticks';
import type { Equipment, GameState } from '../types';
import { dInt } from './eventCore';
import { buyOrder } from './orders';
import { spawnStaff, staffAgents } from './staff';
import { spawnVisit } from './visits';

/** The prep unit of an open Media Facility, or null. The facility is open when a media room holds a prep unit. */
export function prepUnit(state: GameState): Equipment | null {
  for (const eq of Object.values(state.equipment).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))) {
    if (eq.defId !== 'mediaprep') continue;
    const plotId = plotOf(eq);
    if (plotId && state.plots[plotId]?.owned && state.plots[plotId]?.roomType === 'media') return eq;
  }
  return null;
}

export function facilityOpen(state: GameState): boolean {
  return prepUnit(state) !== null;
}

/** The plot id of the open Media Facility, or null. */
export function facilityPlot(state: GameState): string | null {
  const u = prepUnit(state);
  return u ? plotOf(u) : null;
}

/** Whether a media technician is on the payroll. */
function hasMediaTech(state: GameState): boolean {
  return staffAgents(state).some((a) => a.staff?.role === 'mediatech');
}

function nextVisitorTicks(state: GameState): number {
  const lo = secondsToTicks(FACILITY.visitorMinSec);
  const hi = secondsToTicks(FACILITY.visitorMaxSec);
  return lo + dInt(state, hi - lo + 1);
}

/** A name and trait for the technician. They come from a hash of the seed, so no random stream moves. */
function techIdentity(state: GameState): { name: string; trait: (typeof TRAIT_ORDER)[number]; colour: (typeof PORTRAIT_COLOURS)[number] } {
  let rs = (state.seed ^ 0x6d656469) >>> 0;
  const draw = (n: number): number => {
    const r = mulberry32(rs);
    rs = r.state;
    return Math.floor(r.value * n);
  };
  const taken = new Set(staffAgents(state).map((a) => a.staff?.name ?? ''));
  let k = draw(STAFF_NAMES.length);
  for (let t = 0; t < STAFF_NAMES.length && taken.has(STAFF_NAMES[k] as string); t++) k = (k + 1) % STAFF_NAMES.length;
  return {
    name: STAFF_NAMES[k] as string,
    trait: TRAIT_ORDER[draw(TRAIT_ORDER.length)] as (typeof TRAIT_ORDER)[number],
    colour: PORTRAIT_COLOURS[draw(PORTRAIT_COLOURS.length)] as (typeof PORTRAIT_COLOURS)[number],
  };
}

/** A visitor has walked in and stands in the room: if there is media to spare, they buy it. */
export function visitorBuys(state: GameState, events: SimEvent[]): void {
  const f = state.facility;
  const line = (list: readonly string[]): string => list[dInt(state, list.length)] as string;
  if (state.stock.media > FACILITY.reserve) {
    const n = Math.min(FACILITY.bottlesPerVisitor, state.stock.media);
    const pay = n * FACILITY.pricePerBottle;
    state.stock.media -= n;
    state.funds += pay;
    f.earned += pay;
    state.stats.mediaSold += n;
    state.stats.visitorsServed += 1;
    events.push({ type: 'Toast', text: `A researcher bought ${n} media. +${pay} Funds. "${line(VISITOR_LINES)}"` });
  } else {
    events.push({ type: 'Toast', text: `"${line(VISITOR_EMPTY_LINES)}"` });
  }
}

/**
 * The Media Facility: the technician arrives when it opens, auto-reorder buys powder when it runs
 * low, and a researcher from next door walks in every 60 to 90 s.
 */
export function facilitySystem(state: GameState, events: SimEvent[]): void {
  const f = state.facility;
  if (!facilityOpen(state)) {
    f.visitorTicks = -1;
    return;
  }
  if (!hasMediaTech(state)) {
    const id = techIdentity(state);
    const agent = spawnStaff(state, 'mediatech', id.name, id.trait, id.colour);
    events.push({ type: 'StaffHired', agentId: agent.id, name: id.name });
    events.push({ type: 'Toast', text: `${id.name} arrives as media technician. The Media Kitchen is open` });
  }
  if (f.autoReorder && state.tick % 10 === 0 && state.stock.mediaPowder < FACILITY.reorderBelow) {
    const pending =
      state.orders.some((o) => o.orderId === FACILITY.reorderOrder) || state.boxes.some((b) => b.orderId === FACILITY.reorderOrder) || state.lostBoxes.some((b) => b.orderId === FACILITY.reorderOrder);
    if (!pending) buyOrder(state, FACILITY.reorderOrder, events, true);
  }
  if (f.visitorTicks < 0) f.visitorTicks = secondsToTicks(FACILITY.firstVisitorSec);
  f.visitorTicks -= 1;
  if (f.visitorTicks <= 0) {
    f.visitorTicks = nextVisitorTicks(state);
    spawnVisit(state, 'media', events);
  }
}
