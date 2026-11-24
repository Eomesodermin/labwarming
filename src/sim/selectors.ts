import { DAY_END_HOUR, DAY_START_HOUR, TICKS_PER_DAY, TICKS_PER_SECOND } from '../content/balance';
import { EQUIPMENT } from '../content/equipment';
import { FACILITY, GOALS, type GoalId } from '../content/facility';
import { ITEM_NAMES } from '../content/items';
import { JOBS, jobsForStation } from '../content/jobs';
import { TODO_STEPS, type TodoStat } from '../content/tutorial';
import { FRIDGE_REPAIR_COST, PAPER, PRESENTATION } from '../content/economy';
import { ORDERS, ORDER_IDS } from '../content/orders';
import { PLAYER_ID, type Command } from './commands';
import { baseTile } from './grid';
import { coldCapacity, coldUsed, dryCapacity, dryUsed, plotOf, wasteCapacity } from './stock';
import { atStation, facedStation, startBlocker, stationHasMenu } from './systems/jobs';
import { openGrant, openGrants } from './systems/grants';
import { engineerPrice } from './systems/machines';
import { paperCost } from './systems/papers';
import { FAILURES, INSPECTION } from '../content/events';
import { orderBlocker, spendBlocker } from './funds';
import { HIREABLE_ROLES, ROLES, TRAITS, ENERGY, MOOD, type PortraitColour, type StaffRole, type TraitId } from '../content/staff';
import { hireBlocker, isOnBreak, roleBlocker, staffAgents } from './systems/staff';
import { slotsOf } from './systems/cultures';
import { facilityOpen, facilityPlot } from './systems/facility';
import { goalValue, goalTimeSec } from './systems/goals';
import { autoclaveCapacity } from './systems/machines';
import { ROOMS } from '../content/rooms';
import type { Agent, Equipment, GameState, Plot } from './types';

/** Time of day on the 24 hour clock. The day runs from 08:00 to 18:00. */
export function clockTime(state: GameState): { hour: number; minute: number } {
  const minutesIntoDay = Math.floor((state.clock.tickOfDay * (DAY_END_HOUR - DAY_START_HOUR) * 60) / TICKS_PER_DAY);
  return { hour: DAY_START_HOUR + Math.floor(minutesIntoDay / 60), minute: minutesIntoDay % 60 };
}

export function formatClock(state: GameState): string {
  const { hour, minute } = clockTime(state);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getPlayer(state: GameState): Agent {
  const p = state.agents[PLAYER_ID];
  if (!p) throw new Error('The player agent is missing');
  return p;
}

export interface PromptOption {
  /** The key that starts it: E for the first job, Q for the second. */
  key: 'E' | 'Q';
  jobId: string;
  name: string;
  /** Why it cannot be done right now, or null. */
  reason: string | null;
}

export interface StationPrompt {
  stationId: string;
  stationName: string;
  options: PromptOption[];
  /** One line of extra information, such as how full the bin is. */
  info: string | null;
  /** True when E opens a menu here instead of starting a job (the desk, and a broken fridge). */
  menu: boolean;
  /** The job being worked here, with progress 0 to 1. */
  working: { jobName: string; fraction: number } | null;
}

function stationInfo(state: GameState, eq: Equipment): string | null {
  const plotId = plotOf(eq);
  const plot = plotId ? state.plots[plotId] : undefined;
  switch (eq.defId) {
    case 'bin':
      return plot ? `Waste ${plot.waste}/${wasteCapacity(state, plotId as string)}` : null;
    case 'spray':
      return plot ? `Room cleanliness ${Math.round(plot.cleanliness)}%` : null;
    case 'incubator': {
      const mine = state.cultures.filter((c) => c.incubatorId === eq.id);
      const ready = mine.filter((c) => c.status === 'ready').length;
      const bad = mine.filter((c) => c.status === 'contaminated').length;
      const growing = mine.filter((c) => c.status === 'growing');
      const next = growing.length > 0 ? Math.ceil(Math.min(...growing.map((c) => c.growTicksLeft)) / TICKS_PER_SECOND) : 0;
      const parts = [`Cultures ${mine.length}/${slotsOf(eq)}`];
      if (ready) parts.push(`${ready} ready`);
      if (bad) parts.push(`${bad} contaminated`);
      if (growing.length) parts.push(`next ready in ${next} s`);
      return parts.join(', ');
    }
    case 'bay': {
      const n = state.boxes.length;
      const ordered = state.orders.length;
      const parts = [n === 0 ? 'No boxes waiting' : `${n} box${n === 1 ? '' : 'es'} waiting`];
      if (ordered > 0) parts.push(`${ordered} on the way`);
      return parts.join(', ');
    }
    case 'desk': {
      const review = state.papers.filter((p) => p.status === 'review').length;
      const revise = state.papers.filter((p) => p.status === 'revise').length;
      const parts = [`Data ${state.data}`];
      if (review) parts.push(`${review} in review`);
      if (revise) parts.push(`${revise} to revise`);
      return parts.join(', ');
    }
    case 'autoclave': {
      if (eq.broken) return eq.repairTicks && eq.repairTicks > 0 ? `Out of service. Engineer in ${Math.ceil(eq.repairTicks / TICKS_PER_SECOND)} s` : 'Out of service. Coax it or call the engineer';
      if (!eq.cycle) return `Holds ${autoclaveCapacity(eq)} flasks per cycle`;
      if (eq.cycle.ticksLeft > 0) return `${eq.cycle.flasks} flasks, ${Math.ceil(eq.cycle.ticksLeft / TICKS_PER_SECOND)} s left`;
      return `${eq.cycle.flasks} flasks waiting for room on the shelf`;
    }
    case 'fridge':
      return `Cold storage ${coldUsed(state)}/${coldCapacity(state)}${eq.broken ? ' (broken, holds less)' : ''}`;
    case 'bench':
      return eq.outTicks && eq.outTicks > 0 ? `Installing updates, ${Math.ceil(eq.outTicks / TICKS_PER_SECOND)} s left` : null;
    case 'shelf':
      return `Dry storage ${dryUsed(state)}/${dryCapacity(state)}`;
    case 'mediaprep': {
      const f = state.facility;
      return `Media ${state.stock.media}/${f.target}, powder ${state.stock.mediaPowder}${f.batchLeft > 0 ? ` (+${f.batchLeft} bottles open)` : ''}`;
    }
    default:
      return null;
  }
}

/** What to show when the player faces a piece of equipment from the front, or null. */
export function stationPrompt(state: GameState): StationPrompt | null {
  const player = getPlayer(state);
  if (player.path.length > 0) return null;
  const eq = facedStation(state, player);
  if (!eq || !atStation(player, eq)) return null;
  const menu = stationMenu(state, eq);
  const defs = jobsForStation(eq.defId);
  if (!menu && defs.length === 0 && EQUIPMENT[eq.defId]?.category === 'decor') return null; // a plant has nothing to say
  const options: PromptOption[] = menu
    ? [{ key: 'E', jobId: '', name: menu.title, reason: null }]
    : defs.slice(0, 2).map((d, i) => ({
        key: i === 0 ? 'E' : 'Q',
        jobId: d.id,
        name: d.name,
        reason: startBlocker(state, d, eq, PLAYER_ID),
      }));
  const job = player.jobId ? state.jobs[player.jobId] : undefined;
  const working =
    job && job.stationId === eq.id
      ? { jobName: JOBS[job.defId as keyof typeof JOBS]?.name ?? '', fraction: job.progressTicks / job.totalTicks }
      : null;
  return { stationId: eq.id, stationName: EQUIPMENT[eq.defId]?.name ?? eq.defId, options, info: stationInfo(state, eq), menu: menu !== null, working };
}

export interface TodoItem {
  id: string;
  text: string;
  hint: string;
  done: boolean;
}

/** The sticky-note to-do list. Steps tick off from the stats counters. */
export function todoList(state: GameState): TodoItem[] {
  const value = (stat: TodoStat): number => {
    switch (stat) {
      case 'readyCultures':
        return state.stats.culturesGrown;
      case 'fridgeRepaired':
        return Object.values(state.equipment).some((e) => e.defId === 'fridge' && e.broken) ? 0 : 1;
      case 'seedlingApplied':
        return state.grants['seedling'] ? 1 : 0;
      default:
        return state.stats[stat];
    }
  };
  return TODO_STEPS.map((s) => ({ id: s.id, text: s.text, hint: s.hint, done: value(s.stat) >= s.target }));
}

export function roomOfPlayer(state: GameState): Plot | null {
  const p = getPlayer(state);
  const id = baseTile(p.x, p.y).plotId;
  return id ? (state.plots[id] ?? null) : null;
}

export interface MenuEntry {
  id: string;
  group: string;
  label: string;
  /** Cost and time, such as "50 Data, 20 s". */
  detail: string;
  /** Why it cannot be done right now, or null. */
  reason: string | null;
  command: Command;
  /** Opens a panel instead of sending the command. */
  panel?: 'media';
}

export interface StationMenu {
  stationId: string;
  title: string;
  entries: MenuEntry[];
}

function jobEntry(state: GameState, eq: Equipment, jobId: keyof typeof JOBS, detail: string): MenuEntry {
  const def = JOBS[jobId];
  return {
    id: jobId,
    group: 'Work',
    label: def.name,
    detail,
    reason: startBlocker(state, def, eq, PLAYER_ID),
    command: { type: 'Interact', stationId: eq.id, jobId },
  };
}

function engineerEntry(state: GameState): MenuEntry {
  const price = engineerPrice(state);
  const coming = Object.values(state.equipment).some((e) => e.defId === 'autoclave' && e.repairTicks && e.repairTicks > 0);
  return {
    id: 'engineer',
    group: 'Out of service',
    label: 'Call the engineer',
    detail: `${price === 0 ? 'First call is free' : `${price} Funds`}, arrives in ${FAILURES.autoclave.engineerSec} s`,
    reason: coming ? 'The engineer is on the way' : price > state.funds ? `Needs ${price} Funds` : null,
    command: { type: 'CallEngineer' },
  };
}

/** The menu for a station, or null when E starts a job directly. */
export function stationMenu(state: GameState, eq: Equipment): StationMenu | null {
  if (!stationHasMenu(eq)) return null;
  if (eq.defId === 'fridge' && eq.broken) {
    return {
      stationId: eq.id,
      title: 'Fridge menu',
      entries: [
        {
          id: 'repair',
          group: 'Repair',
          label: 'Repair the fridge',
          detail: `${FRIDGE_REPAIR_COST} Funds`,
          reason: spendBlocker(state, FRIDGE_REPAIR_COST),
          command: { type: 'RepairEquipment', equipmentId: eq.id },
        },
      ],
    };
  }
  if (eq.defId === 'autoclave' && eq.broken) {
    return {
      stationId: eq.id,
      title: 'Autoclave menu',
      entries: [
        {
          id: 'coax',
          group: 'Out of service',
          label: 'Coax it',
          detail: 'Free, works about half the time',
          reason: eq.repairTicks && eq.repairTicks > 0 ? 'The engineer is on the way' : null,
          command: { type: 'CoaxAutoclave', equipmentId: eq.id },
        },
        engineerEntry(state),
      ],
    };
  }
  if (eq.defId === 'mediaprep') {
    const f = state.facility;
    return {
      stationId: eq.id,
      title: 'Media prep menu',
      entries: [
        jobEntry(state, eq, 'runMediaPrep', `1 bottle, ${FACILITY.bottleSec} s, 6 per powder`),
        {
          id: 'reorder',
          group: 'Settings',
          label: `Auto-reorder is ${f.autoReorder ? 'on' : 'off'}`,
          detail: f.autoReorder ? 'Switch off' : 'Switch on',
          reason: null,
          command: { type: 'SetAutoReorder', on: !f.autoReorder },
        },
        {
          id: 'panel',
          group: 'Settings',
          label: `Target level ${f.target}`,
          detail: 'Open the Media Kitchen panel',
          reason: null,
          command: { type: 'SetMediaTarget', target: f.target },
          panel: 'media',
        },
      ],
    };
  }
  if (eq.defId === 'desk') {
    const grant = openGrant(state) ?? openGrants(state)[0];
    const entries: MenuEntry[] = [
      jobEntry(state, eq, 'writePaper', `${paperCost(state)} Data, ${PAPER.writeSec} s`),
      jobEntry(state, eq, 'revisePaper', `${PAPER.reviseData} Data, ${PAPER.reviseSec} s`),
      jobEntry(state, eq, 'makePresentation', `${PRESENTATION.data} Data, ${PRESENTATION.sec} s`),
      jobEntry(state, eq, 'writeGrant', grant ? grant.name : 'No grant is open'),
    ];
    if (state.inspection) entries.push(jobEntry(state, eq, 'signLogbook', `${INSPECTION.signLogbookSec} s`));
    if (Object.values(state.equipment).some((e) => e.defId === 'autoclave' && e.broken)) entries.push(engineerEntry(state));
    for (const id of ORDER_IDS) {
      const o = ORDERS[id];
      entries.push({
        id,
        group: 'Order',
        label: o.name,
        detail: `${o.price} Funds, ${o.qty} ${ITEM_NAMES[o.item].toLowerCase()}`,
        reason: orderBlocker(state, o.price),
        command: { type: 'PlaceOrder', orderId: id },
      });
    }
    return { stationId: eq.id, title: 'Desk menu', entries };
  }
  return null;
}

/** The menu of the station the player is facing, or null. */
export function facedMenu(state: GameState): StationMenu | null {
  const player = getPlayer(state);
  if (player.path.length > 0) return null;
  const eq = facedStation(state, player);
  if (!eq || !atStation(player, eq)) return null;
  return stationMenu(state, eq);
}

export function unreadCount(state: GameState): number {
  return state.inbox.filter((m) => !m.read).length;
}

/** Number of rooms owned. */
export function roomsOwned(state: GameState): number {
  return Object.values(state.plots).filter((p) => p.owned).length;
}

export interface StaffRow {
  id: string;
  name: string;
  role: StaffRole;
  roleName: string;
  trait: TraitId;
  traitName: string;
  traitText: string;
  colour: PortraitColour;
  salary: number;
  energy: number;
  mood: number;
  /** What they are doing right now, in words. */
  doing: string;
  onBreak: boolean;
  tired: boolean;
  gloomy: boolean;
}

function doingText(state: GameState, a: Agent): string {
  const st = a.staff;
  if (!st) return '';
  if (st.restTicks > 0) return 'Resting, no coffee machine';
  const job = a.jobId ? state.jobs[a.jobId] : undefined;
  if (!job) return st.energy <= ENERGY.breakAt ? 'Looking for a break' : 'Looking for something to do';
  const name = JOBS[job.defId as keyof typeof JOBS]?.name ?? job.defId;
  const eq = state.equipment[job.stationId];
  const there = eq ? atStation(a, eq) : false;
  if (job.defId === 'coffeeBreak') return there ? 'On a coffee break' : 'Walking to the coffee machine';
  return there ? name : `Walking to: ${name}`;
}

/** Everyone on the payroll, for the staff panel. */
export function staffRows(state: GameState): StaffRow[] {
  return staffAgents(state).map((a) => {
    const st = a.staff as NonNullable<Agent['staff']>;
    const trait = TRAITS[st.trait];
    return {
      id: a.id,
      name: st.name,
      role: st.role,
      roleName: ROLES[st.role].name,
      trait: st.trait,
      traitName: trait.name,
      traitText: trait.text,
      colour: st.colour,
      salary: st.salary,
      energy: Math.round(st.energy),
      mood: Math.round(st.mood),
      doing: doingText(state, a),
      onBreak: isOnBreak(state, a),
      tired: st.energy <= ENERGY.breakAt,
      gloomy: st.mood < MOOD.cloudBelow,
    };
  });
}

export interface HireRole {
  role: StaffRole;
  name: string;
  fee: number;
  salary: number;
  speed: number;
  blurb: string;
  /** Why the whole role is locked (or full), or null. */
  locked: string | null;
  hired: number;
  candidates: Array<{
    id: string;
    name: string;
    trait: TraitId;
    traitName: string;
    traitText: string;
    colour: PortraitColour;
    /** Why this person cannot be hired right now (Funds), or null. */
    blocker: string | null;
  }>;
}

/** The hire panel: three candidates per role, with the reason when a role is locked. */
export function hireOptions(state: GameState): HireRole[] {
  return HIREABLE_ROLES.map((role) => {
    const def = ROLES[role];
    const locked = roleBlocker(state, role);
    const blocker = hireBlocker(state, role);
    return {
      role,
      name: def.name,
      fee: def.fee,
      salary: def.salary,
      speed: def.speed,
      blurb: def.blurb,
      locked,
      hired: staffAgents(state).filter((a) => a.staff?.role === role).length,
      candidates: state.candidates
        .filter((c) => c.role === role)
        .map((c) => ({
          id: c.id,
          name: c.name,
          trait: c.trait,
          traitName: TRAITS[c.trait].name,
          traitText: TRAITS[c.trait].text,
          colour: c.colour,
          blocker,
        })),
    };
  });
}

// ---- The Lab Warming list ----

export interface GoalRow {
  id: GoalId;
  text: string;
  hint: string;
  have: number;
  need: number;
  done: boolean;
  /** Play time in seconds when it was reached, or null. */
  atSec: number | null;
}

/** The Lab Warming list. A goal stays done once it was reached. */
export function goalRows(state: GameState): GoalRow[] {
  return GOALS.map((g) => {
    const reached = state.goals.reached[g.id] !== undefined;
    const have = Math.min(g.need, goalValue(state, g.id));
    return { id: g.id, text: g.text, hint: g.hint, have: reached ? g.need : have, need: g.need, done: reached || have >= g.need, atSec: goalTimeSec(state, g.id) };
  });
}

/** How many goals are done, for the ring in the top bar. */
export function goalProgress(state: GameState): { done: number; total: number } {
  const rows = goalRows(state);
  return { done: rows.filter((r) => r.done).length, total: rows.length };
}

// ---- The Media Kitchen panel ----

export interface FacilityView {
  open: boolean;
  /** Why it is not open yet, in words. Null when open. */
  lockedText: string | null;
  target: number;
  targetMin: number;
  targetMax: number;
  autoReorder: boolean;
  media: number;
  powder: number;
  batchLeft: number;
  /** Seconds to the next visitor, or null. */
  nextVisitorSec: number | null;
  sold: number;
  earned: number;
  visitors: number;
  /** What the technician is doing, or null if nobody is there. */
  techDoing: string | null;
}

export function facilityView(state: GameState): FacilityView {
  const f = state.facility;
  const open = facilityOpen(state);
  const plots = Object.values(state.plots);
  const room = plots.find((p) => p.owned && p.roomType === 'media');
  let lockedText: string | null = null;
  if (!open) {
    if (!room) lockedText = state.reputation < ROOMS.media.unlockRep ? `Needs Reputation ${ROOMS.media.unlockRep} (you have ${state.reputation}). Then buy the room for ${ROOMS.media.cost}.` : `Buy a plot as a Media Facility (${ROOMS.media.cost}) in build mode.`;
    else lockedText = 'The room is built. Put a media prep unit (400) inside to open it.';
  }
  const tech = staffRows(state).find((r) => r.role === 'mediatech');
  return {
    open,
    lockedText,
    target: f.target,
    targetMin: FACILITY.targetMin,
    targetMax: FACILITY.targetMax,
    autoReorder: f.autoReorder,
    media: state.stock.media,
    powder: state.stock.mediaPowder,
    batchLeft: f.batchLeft,
    nextVisitorSec: open && f.visitorTicks >= 0 ? Math.ceil(f.visitorTicks / TICKS_PER_SECOND) : null,
    sold: state.stats.mediaSold,
    earned: f.earned,
    visitors: state.stats.visitorsServed,
    techDoing: tech ? tech.doing : null,
  };
}

/** The media plot id, for views that want to point at it. */
export function mediaRoomId(state: GameState): string | null {
  return facilityPlot(state);
}
