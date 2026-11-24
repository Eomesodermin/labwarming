import { EQUIPMENT, investedFunds, maxTier } from '../content/equipment';
import { SELL_REFUND } from '../content/economy';
import { ENTRANCE, MAP_W, PLOTS, type PlotDef } from '../content/map';
import { ROOMS, roomsAllowing } from '../content/rooms';
import { footprintTiles, frontTiles, inBounds, baseTile, tileIndex, walkGrid } from './grid';
import { plotOf } from './stock';
import type { Equipment, GameState, Point, Rot, RoomTypeId } from './types';

export function plotDef(plotId: string): PlotDef | undefined {
  return PLOTS.find((p) => p.id === plotId);
}

/** The tile just inside a plot's door. It stays clear, so the door can always be used. */
export function insideDoorTile(plot: PlotDef): Point {
  return { x: plot.door.x, y: plot.door.y > plot.y ? plot.y + plot.h - 1 : plot.y };
}

/** Where the free spray station goes in a new room: next to the door, facing into the room. */
export function sprayPlacement(plot: PlotDef): { x: number; y: number; rot: Rot } {
  const inside = insideDoorTile(plot);
  return { x: inside.x + 1, y: inside.y, rot: plot.door.y > plot.y ? 2 : 0 };
}

/** Equipment that lives inside a room. The delivery bay stands in the corridor and is left out. */
export function roomEquipment(state: GameState): Equipment[] {
  return Object.values(state.equipment).filter((e) => plotOf(e) !== null);
}

/** True when `from` can walk to any of `goals` over the plot's floor, with `blocked` tiles in the way. */
function reachable(plot: PlotDef, from: Point, goals: readonly Point[], blocked: ReadonlySet<string>): boolean {
  const inPlot = (x: number, y: number): boolean => x >= plot.x && x < plot.x + plot.w && y >= plot.y && y < plot.y + plot.h;
  const key = (x: number, y: number): string => `${x},${y}`;
  if (blocked.has(key(from.x, from.y))) return false;
  const seen = new Set<string>([key(from.x, from.y)]);
  const queue: Point[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i] as Point;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      const k = key(nx, ny);
      if (!inPlot(nx, ny) || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return goals.some((g) => seen.has(key(g.x, g.y)));
}

export interface PlacementOptions {
  /** The piece being moved. It is ignored when checking for overlaps. */
  ignoreId?: string;
}

/**
 * Why a piece of equipment cannot go here, or null if it can. Design doc 3.2: the footprint must be
 * on free floor in a room that allows it, the doors stay clear, and the tile in front must be free
 * and reachable from the door. Funds are checked by the command, not here.
 */
export function placementBlocker(
  state: GameState,
  defId: string,
  x: number,
  y: number,
  rot: Rot,
  opts: PlacementOptions = {},
): string | null {
  const def = EQUIPMENT[defId];
  if (!def || def.price === null) return 'That cannot be built';
  const probe: Equipment = { id: '_ghost', defId, tier: 1, x, y, rot, broken: false, cycle: null };
  const tiles = footprintTiles(probe);

  let plotId: string | null = null;
  for (const t of tiles) {
    const b = baseTile(t.x, t.y);
    if (!inBounds(t.x, t.y) || b.kind !== 'floor' || b.plotId === null) return 'Must go inside a room';
    if (plotId !== null && plotId !== b.plotId) return 'Must fit inside one room';
    plotId = b.plotId;
  }
  const plot = plotId ? plotDef(plotId) : undefined;
  const room = plotId ? state.plots[plotId] : undefined;
  if (!plot || !room || !room.owned || !room.roomType) return 'Buy this plot first';
  if (!ROOMS[room.roomType].allows.includes(defId)) {
    const where = roomsAllowing(defId).map((r) => r.name);
    return `Not for a ${ROOMS[room.roomType].name}. Try: ${where.join(', ')}`;
  }

  const inside = insideDoorTile(plot);
  if (tiles.some((t) => t.x === inside.x && t.y === inside.y)) return 'Keep the door clear';

  const blocked = new Set<string>();
  for (const other of Object.values(state.equipment)) {
    if (other.id === opts.ignoreId) continue;
    for (const t of footprintTiles(other)) blocked.add(`${t.x},${t.y}`);
  }
  if (tiles.some((t) => blocked.has(`${t.x},${t.y}`))) return 'Something is already there';

  const player = state.agents['player'];
  if (player) {
    const stands = [{ x: player.x, y: player.y }, ...(player.path[0] ? [player.path[0]] : [])];
    if (tiles.some((t) => stands.some((s) => s.x === t.x && s.y === t.y))) return 'Someone is standing there';
  }

  const fronts = frontTiles(probe);
  const floorFronts = fronts.filter((f) => baseTile(f.x, f.y).kind === 'floor' && baseTile(f.x, f.y).plotId === plotId);
  if (floorFronts.length === 0) return 'The front is against a wall';
  for (const t of tiles) blocked.add(`${t.x},${t.y}`);
  const freeFronts = floorFronts.filter((f) => !blocked.has(`${f.x},${f.y}`));
  if (freeFronts.length === 0) return 'Something blocks the front';
  if (!reachable(plot, inside, freeFronts, blocked)) return 'No way to walk to the front from the door';
  return null;
}

export interface SellInfo {
  refund: number;
  /** Why it cannot be sold, or null. */
  blocker: string | null;
}

export function sellInfo(state: GameState, eq: Equipment): SellInfo {
  const def = EQUIPMENT[eq.defId];
  const refund = Math.floor(investedFunds(eq.defId, eq.tier) * SELL_REFUND);
  if (!def || def.price === null || plotOf(eq) === null) return { refund: 0, blocker: 'This cannot be sold' };
  if (eq.defId === 'incubator' && state.cultures.some((c) => c.incubatorId === eq.id)) {
    return { refund, blocker: 'Empty the incubator first' };
  }
  if (eq.defId === 'autoclave' && eq.cycle) return { refund, blocker: 'Wait for the cycle to finish' };
  return { refund, blocker: null };
}

export interface UpgradeInfo {
  price: number;
  /** Why it cannot be upgraded now, or null. */
  blocker: string | null;
  /** False when there is no next tier at all. */
  hasNext: boolean;
}

export function upgradeInfo(state: GameState, eq: Equipment): UpgradeInfo {
  const def = EQUIPMENT[eq.defId];
  const next = def?.upgrades[eq.tier - 1];
  if (!def || !next || eq.tier >= maxTier(eq.defId)) return { price: 0, blocker: 'Fully upgraded', hasNext: false };
  if (eq.broken) return { price: next.price, blocker: 'Repair it first', hasNext: true };
  if (next.rep !== undefined && state.reputation < next.rep) return { price: next.price, blocker: `Needs Reputation ${next.rep}`, hasNext: true };
  if (state.funds < next.price) return { price: next.price, blocker: `Needs ${next.price} Funds`, hasNext: true };
  return { price: next.price, blocker: null, hasNext: true };
}

export interface RoomBlocker {
  roomType: RoomTypeId;
  blocker: string | null;
}

/** Why a plot cannot be bought as this room type, or null. */
export function buyPlotBlocker(state: GameState, plotId: string, roomType: RoomTypeId): string | null {
  const plot = state.plots[plotId];
  if (!plot || !plotDef(plotId)) return 'No such plot';
  if (plot.owned) return 'You already own this plot';
  const room = ROOMS[roomType];
  if (state.reputation < room.unlockRep) return `Needs Reputation ${room.unlockRep}`;
  if (!room.available) return room.note;
  if (state.funds < room.cost) return `Needs ${room.cost} Funds`;
  return null;
}

/** Equipment with no free tile in front that the player can walk to from the entrance. */
export interface PathWarning {
  equipmentId: string;
  text: string;
}

export function pathWarnings(state: GameState): PathWarning[] {
  const walk = walkGrid(state);
  const seen = new Uint8Array(walk.length);
  const queue: number[] = [];
  const start = tileIndex(ENTRANCE.x, ENTRANCE.y);
  if (walk[start] === 1) {
    seen[start] = 1;
    queue.push(start);
  }
  const width = MAP_W;
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i] as number;
    const cx = c % width;
    const cy = Math.floor(c / width);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const n = tileIndex(nx, ny);
      if (walk[n] !== 1 || seen[n] === 1) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  const out: PathWarning[] = [];
  for (const eq of roomEquipment(state)) {
    const ok = frontTiles(eq).some((f) => inBounds(f.x, f.y) && seen[tileIndex(f.x, f.y)] === 1);
    if (!ok) out.push({ equipmentId: eq.id, text: `No path to the ${(EQUIPMENT[eq.defId]?.name ?? eq.defId).toLowerCase()}` });
  }
  return out;
}
