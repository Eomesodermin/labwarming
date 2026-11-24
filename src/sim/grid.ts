import { EQUIPMENT } from '../content/equipment';
import { MAP_H, MAP_ROWS, MAP_W, PLOTS } from '../content/map';
import type { Dir, Equipment, GameState, Point, Rot } from './types';

export type TileKind = 'outside' | 'wall' | 'floor' | 'door' | 'corridor' | 'entrance';

export interface BaseTile {
  kind: TileKind;
  /** The plot whose interior or door this tile is. */
  plotId: string | null;
}

const doorPlot = new Map<string, string>();
for (const p of PLOTS) doorPlot.set(`${p.door.x},${p.door.y}`, p.id);

function parseTile(ch: string, x: number, y: number): BaseTile {
  switch (ch) {
    case '#':
      return { kind: 'wall', plotId: null };
    case 'D':
      return { kind: 'door', plotId: doorPlot.get(`${x},${y}`) ?? null };
    case '=':
      return { kind: 'corridor', plotId: null };
    case 'E':
      return { kind: 'entrance', plotId: null };
    case '.':
      return { kind: 'outside', plotId: null };
    default:
      return { kind: 'floor', plotId: ch };
  }
}

const baseTiles: BaseTile[] = [];
for (let y = 0; y < MAP_H; y++) {
  const row = MAP_ROWS[y] ?? '';
  for (let x = 0; x < MAP_W; x++) baseTiles.push(parseTile(row[x] ?? '.', x, y));
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

export function tileIndex(x: number, y: number): number {
  return y * MAP_W + x;
}

/** The fixed map tile at (x, y), ignoring ownership and equipment. */
export function baseTile(x: number, y: number): BaseTile {
  const t = inBounds(x, y) ? baseTiles[tileIndex(x, y)] : undefined;
  return t ?? { kind: 'outside', plotId: null };
}

export const DIR_VECTORS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const ROT_FACING: Record<Rot, Dir> = { 0: 'down', 1: 'left', 2: 'up', 3: 'right' };

export function dirBetween(from: Point, to: Point): Dir | null {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export function opposite(d: Dir): Dir {
  return { up: 'down', down: 'up', left: 'right', right: 'left' }[d] as Dir;
}

/** Width and height of a piece of equipment after rotation. */
export function footprintSize(eq: Pick<Equipment, 'defId' | 'rot'>): { w: number; h: number } {
  const def = EQUIPMENT[eq.defId];
  if (!def) return { w: 1, h: 1 };
  return eq.rot % 2 === 1 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export function footprintTiles(eq: Equipment): Point[] {
  const { w, h } = footprintSize(eq);
  const out: Point[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: eq.x + dx, y: eq.y + dy });
  return out;
}

/** The tiles directly in front of the equipment, where someone stands to use it. */
export function frontTiles(eq: Equipment): Point[] {
  const { w, h } = footprintSize(eq);
  const out: Point[] = [];
  switch (eq.rot) {
    case 0:
      for (let dx = 0; dx < w; dx++) out.push({ x: eq.x + dx, y: eq.y + h });
      break;
    case 2:
      for (let dx = 0; dx < w; dx++) out.push({ x: eq.x + dx, y: eq.y - 1 });
      break;
    case 1:
      for (let dy = 0; dy < h; dy++) out.push({ x: eq.x - 1, y: eq.y + dy });
      break;
    case 3:
      for (let dy = 0; dy < h; dy++) out.push({ x: eq.x + w, y: eq.y + dy });
      break;
  }
  return out;
}

/** The equipment occupying tile (x, y), if any. */
export function equipmentAt(state: GameState, x: number, y: number): Equipment | null {
  for (const eq of Object.values(state.equipment)) {
    for (const t of footprintTiles(eq)) if (t.x === x && t.y === y) return eq;
  }
  return null;
}

interface WalkCache {
  version: number;
  walk: Uint8Array;
}
const walkCaches = new WeakMap<GameState, WalkCache>();

function computeWalk(state: GameState): Uint8Array {
  const walk = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = baseTile(x, y);
      let ok = false;
      if (t.kind === 'corridor' || t.kind === 'entrance') ok = true;
      else if (t.kind === 'floor' || t.kind === 'door') ok = t.plotId !== null && state.plots[t.plotId]?.owned === true;
      walk[tileIndex(x, y)] = ok ? 1 : 0;
    }
  }
  for (const eq of Object.values(state.equipment)) {
    for (const t of footprintTiles(eq)) if (inBounds(t.x, t.y)) walk[tileIndex(t.x, t.y)] = 0;
  }
  return walk;
}

/** Walkability for every tile, rebuilt only when `state.gridVersion` changes. */
export function walkGrid(state: GameState): Uint8Array {
  const cached = walkCaches.get(state);
  if (cached && cached.version === state.gridVersion) return cached.walk;
  const walk = computeWalk(state);
  walkCaches.set(state, { version: state.gridVersion, walk });
  return walk;
}

export function isWalkable(state: GameState, x: number, y: number): boolean {
  return inBounds(x, y) && walkGrid(state)[tileIndex(x, y)] === 1;
}
