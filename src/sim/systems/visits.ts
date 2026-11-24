import { CAKE_SPOT, DIRECTOR, VISIT_DWELL_SEC, WALKTHROUGH } from '../../content/events';
import { ENTRANCE, MAP_H, MAP_W, PLOTS } from '../../content/map';
import { ENERGY } from '../../content/staff';
import { baseTile, frontTiles, isWalkable } from '../grid';
import { findPath } from '../pathfinding';
import type { SimEvent } from '../simEvents';
import { secondsToTicks } from '../ticks';
import type { Agent, AgentKind, GameState, Point, Visit, VisitKind } from '../types';
import { finishInspection, inspectRoom } from './inspection';

const AGENTS_FOR: Record<VisitKind, AgentKind[]> = {
  cake: ['pi'],
  walkthrough: ['pi', 'visitor'],
  inspection: ['inspector'],
  courier: ['courier'],
};

function spawnAgent(state: GameState, kind: AgentKind): Agent {
  const a: Agent = {
    id: `v${state.nextId++}`,
    kind,
    x: ENTRANCE.x,
    y: ENTRANCE.y,
    facing: 'right',
    path: [],
    moveProgress: 0,
    arriveFacing: null,
    jobId: null,
    pendingStation: null,
    staff: null,
  };
  state.agents[a.id] = a;
  return a;
}

/** A walkable tile near the middle of a plot that can be reached from the entrance, or null. */
export function roomStop(state: GameState, plotId: string): Point | null {
  const p = PLOTS.find((q) => q.id === plotId);
  if (!p) return null;
  const cx = p.x + (p.w - 1) / 2;
  const cy = p.y + (p.h - 1) / 2;
  const tiles: Point[] = [];
  for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) tiles.push({ x, y });
  tiles.sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)) || a.y - b.y || a.x - b.x);
  for (const t of tiles) {
    if (!isWalkable(state, t.x, t.y)) continue;
    if (findPath(state, ENTRANCE, t)) return t;
  }
  return null;
}

/** Corridor tiles where a lost box can land: clear of the delivery bay, and walkable. */
export function corridorTiles(state: GameState): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 5; x < MAP_W; x++) {
      if (baseTile(x, y).kind === 'corridor' && isWalkable(state, x, y)) out.push({ x, y });
    }
  }
  return out;
}

/** The tile in front of the delivery bay, where Bodo hands a box over. */
export function bayFront(state: GameState): Point {
  const bay = Object.values(state.equipment).find((e) => e.defId === 'bay');
  const t = bay ? frontTiles(bay)[0] : undefined;
  return t ?? { x: ENTRANCE.x + 2, y: ENTRANCE.y };
}

function stopsFor(state: GameState, kind: VisitKind, target?: Point): Point[] {
  switch (kind) {
    case 'cake':
      return [{ x: CAKE_SPOT.x - 1, y: CAKE_SPOT.y }];
    case 'courier':
      return [target ?? bayFront(state)];
    case 'walkthrough':
    case 'inspection': {
      const out: Point[] = [];
      for (const def of PLOTS) {
        const plot = state.plots[def.id];
        if (!plot?.owned) continue;
        if (kind === 'walkthrough' && plot.roomType !== 'lab') continue;
        const stop = roomStop(state, def.id);
        if (stop) out.push(stop);
      }
      return out;
    }
  }
}

/** Starts a visit: the characters appear at the entrance and head for the first stop. */
export function spawnVisit(state: GameState, kind: VisitKind, events: SimEvent[], target?: Point): Visit | null {
  const stops = stopsFor(state, kind, target);
  if (stops.length === 0) return null;
  const agents = AGENTS_FOR[kind].map((k) => spawnAgent(state, k));
  const visit: Visit = {
    id: `vis${state.nextId++}`,
    kind,
    agentIds: agents.map((a) => a.id),
    stops,
    stop: -1,
    arrived: true,
    wait: 0,
    leaving: false,
  };
  state.director.visits.push(visit);
  if (kind === 'cake') events.push({ type: 'Toast', text: 'Prof. Quince is at the door. She is carrying a cake' });
  if (kind === 'walkthrough') events.push({ type: 'Toast', text: 'Prof. Quince and a collaborator are coming in. Look busy' });
  if (kind === 'inspection') events.push({ type: 'Toast', text: 'Inspector Tock has arrived with a clipboard' });
  return visit;
}

/** Fire drill: every staff member walks to a spot in the corridor near the entrance. Their jobs wait. */
export function staffToDrillSpots(state: GameState): void {
  const staff = Object.values(state.agents).filter((a) => a.staff !== null);
  staff.forEach((a, i) => {
    const target = { x: 5 + (i % 8), y: 10 };
    const route = isWalkable(state, target.x, target.y) ? findPath(state, { x: a.x, y: a.y }, target) : null;
    a.path = route ?? [];
    a.moveProgress = 0;
    a.arriveFacing = null;
  });
}

/** The fire drill ends when everyone has arrived and stood there for the set time. */
function drillSystem(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  if (!d.drill) return;
  const staff = Object.values(state.agents).filter((a) => a.staff !== null);
  if (staff.some((a) => a.path.length > 0)) return;
  d.drill.ticksLeft -= 1;
  if (d.drill.ticksLeft <= 0) {
    d.drill = null;
    events.push({ type: 'Toast', text: 'It was a test. It is always a test. Back to work' });
  }
}

function onArrive(state: GameState, visit: Visit, events: SimEvent[]): void {
  const here = visit.stops[visit.stop];
  if (!here) return;
  if (visit.kind === 'cake') {
    state.director.cake = { x: CAKE_SPOT.x, y: CAKE_SPOT.y };
    state.flags['cakeTicks'] = secondsToTicks(DIRECTOR.cakeSec);
    state.flags['moodNow'] = true;
    for (const a of Object.values(state.agents)) {
      if (!a.staff) continue;
      a.staff.energy = ENERGY.max;
      a.staff.workAcc = 0;
    }
    events.push({ type: 'Toast', text: 'Cake! Everyone is rested and in a good mood for a minute' });
  } else if (visit.kind === 'inspection') {
    const plotId = baseTile(here.x, here.y).plotId;
    if (plotId) inspectRoom(state, plotId);
  }
}

function onFinish(state: GameState, visit: Visit, events: SimEvent[]): void {
  if (visit.kind === 'inspection') {
    finishInspection(state, events);
  } else if (visit.kind === 'walkthrough') {
    const labs = Object.values(state.plots).filter((p) => p.owned && p.roomType === 'lab');
    const tidy = labs.length > 0 && labs.every((p) => p.cleanliness >= WALKTHROUGH.cleanAtLeast);
    if (tidy) {
      state.reputation += WALKTHROUGH.reputation;
      events.push({ type: 'Toast', text: WALKTHROUGH.cleanText });
    } else {
      events.push({ type: 'Toast', text: WALKTHROUGH.messyText });
    }
  }
}

function despawn(state: GameState, visit: Visit): void {
  for (const id of visit.agentIds) delete state.agents[id];
  state.director.visits = state.director.visits.filter((v) => v.id !== visit.id);
}

function setPath(state: GameState, visit: Visit, to: Point): boolean {
  const leader = state.agents[visit.agentIds[0] ?? ''];
  if (!leader) return false;
  const route = findPath(state, { x: leader.x, y: leader.y }, to);
  if (!route) return false;
  for (const id of visit.agentIds) {
    const a = state.agents[id];
    if (!a) continue;
    a.path = route.map((p) => ({ x: p.x, y: p.y }));
    a.moveProgress = 0;
  }
  return true;
}

/** Visitors walk their stops, stand a while at each, then leave by the entrance and are removed. */
export function visitsSystem(state: GameState, events: SimEvent[]): void {
  drillSystem(state, events);
  for (const visit of [...state.director.visits]) {
    const leader = state.agents[visit.agentIds[0] ?? ''];
    if (!leader) {
      despawn(state, visit);
      continue;
    }
    if (leader.path.length > 0) continue; // still walking
    if (visit.leaving) {
      if (leader.x === ENTRANCE.x && leader.y === ENTRANCE.y) despawn(state, visit);
      else if (!setPath(state, visit, ENTRANCE)) despawn(state, visit);
      continue;
    }
    const here = visit.stops[visit.stop];
    if (!visit.arrived) {
      if (here && (leader.x !== here.x || leader.y !== here.y)) {
        // The way changed under them: try again, or skip the stop.
        if (!setPath(state, visit, here)) visit.arrived = true;
        continue;
      }
      visit.arrived = true;
      visit.wait = secondsToTicks(VISIT_DWELL_SEC[visit.kind]);
      onArrive(state, visit, events);
    }
    if (visit.wait > 0) {
      visit.wait -= 1;
      continue;
    }
    visit.stop += 1;
    const next = visit.stops[visit.stop];
    if (next) {
      visit.arrived = false;
      if (!setPath(state, visit, next)) visit.arrived = true;
      continue;
    }
    onFinish(state, visit, events);
    visit.leaving = true;
    if (!setPath(state, visit, ENTRANCE)) despawn(state, visit);
  }
}

/** The player walks over a lost box and picks it up. It joins the boxes at the delivery bay. */
export function lostBoxSystem(state: GameState, events: SimEvent[]): void {
  if (state.lostBoxes.length === 0) return;
  const p = state.agents['player'];
  if (!p) return;
  const found = state.lostBoxes.find((b) => b.x === p.x && b.y === p.y);
  if (!found) return;
  state.lostBoxes = state.lostBoxes.filter((b) => b !== found);
  state.boxes.push({ id: `b${state.nextId++}`, orderId: found.orderId, qty: found.qty });
  events.push({ type: 'Toast', text: 'Found it! The box is back at the delivery bay' });
}
