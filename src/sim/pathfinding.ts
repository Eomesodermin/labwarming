import { MAP_H, MAP_W } from '../content/map';
import { inBounds, tileIndex, walkGrid } from './grid';
import type { GameState, Point } from './types';

interface PathCache {
  version: number;
  paths: Map<string, Point[] | null>;
}
const caches = new WeakMap<GameState, PathCache>();

function cacheFor(state: GameState): PathCache {
  let c = caches.get(state);
  if (!c || c.version !== state.gridVersion) {
    c = { version: state.gridVersion, paths: new Map() };
    caches.set(state, c);
  }
  return c;
}

/** Number of cached paths for the current grid version. Exposed for tests. */
export function pathCacheSize(state: GameState): number {
  const c = caches.get(state);
  return c && c.version === state.gridVersion ? c.paths.size : 0;
}

const SIZE = MAP_W * MAP_H;
const DX = [0, -1, 1, 0]; // up, left, right, down: a fixed order keeps ties deterministic
const DY = [-1, 0, 0, 1];

/** Binary min-heap over node indices, ordered by f, then h, then index. */
class Heap {
  private items: number[] = [];
  constructor(
    private readonly f: Float64Array,
    private readonly h: Float64Array,
  ) {}
  get size(): number {
    return this.items.length;
  }
  private less(a: number, b: number): boolean {
    if (this.f[a] !== this.f[b]) return (this.f[a] ?? 0) < (this.f[b] ?? 0);
    if (this.h[a] !== this.h[b]) return (this.h[a] ?? 0) < (this.h[b] ?? 0);
    return a < b;
  }
  push(n: number): void {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i] as number, a[p] as number)) break;
      [a[i], a[p]] = [a[p] as number, a[i] as number];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0] as number;
    const last = a.pop() as number;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l] as number, a[m] as number)) m = l;
        if (r < a.length && this.less(a[r] as number, a[m] as number)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m] as number, a[i] as number];
        i = m;
      }
    }
    return top;
  }
}

function astar(state: GameState, from: Point, to: Point): Point[] | null {
  if (!inBounds(to.x, to.y) || !inBounds(from.x, from.y)) return null;
  const walk = walkGrid(state);
  const goal = tileIndex(to.x, to.y);
  if (walk[goal] !== 1) return null;
  const start = tileIndex(from.x, from.y);
  if (start === goal) return [];

  const g = new Float64Array(SIZE).fill(Infinity);
  const f = new Float64Array(SIZE).fill(Infinity);
  const h = new Float64Array(SIZE);
  const parent = new Int32Array(SIZE).fill(-1);
  const closed = new Uint8Array(SIZE);
  const open = new Heap(f, h);

  const heuristic = (x: number, y: number): number => Math.abs(x - to.x) + Math.abs(y - to.y);
  g[start] = 0;
  h[start] = heuristic(from.x, from.y);
  f[start] = h[start] as number;
  open.push(start);

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) {
      const out: Point[] = [];
      for (let n = cur; n !== start; n = parent[n] as number) out.push({ x: n % MAP_W, y: Math.floor(n / MAP_W) });
      return out.reverse();
    }
    const cx = cur % MAP_W;
    const cy = Math.floor(cur / MAP_W);
    for (let d = 0; d < 4; d++) {
      const nx = cx + (DX[d] as number);
      const ny = cy + (DY[d] as number);
      if (!inBounds(nx, ny)) continue;
      const ni = tileIndex(nx, ny);
      if (walk[ni] !== 1 || closed[ni]) continue;
      const ng = (g[cur] as number) + 1;
      if (ng < (g[ni] as number)) {
        g[ni] = ng;
        h[ni] = heuristic(nx, ny);
        f[ni] = ng + (h[ni] as number);
        parent[ni] = cur;
        open.push(ni);
      }
    }
  }
  return null;
}

/**
 * Shortest 4-way path on walkable tiles. The result excludes the start tile and includes the goal.
 * An empty array means start and goal are the same tile. Null means no path.
 * Results are cached per start and goal until the grid version changes.
 */
export function findPath(state: GameState, from: Point, to: Point): Point[] | null {
  const cache = cacheFor(state);
  const key = `${from.x},${from.y}>${to.x},${to.y}`;
  if (cache.paths.has(key)) {
    const hit = cache.paths.get(key) ?? null;
    return hit ? hit.map((p) => ({ ...p })) : null;
  }
  const path = astar(state, from, to);
  cache.paths.set(key, path);
  return path ? path.map((p) => ({ ...p })) : null;
}

/** The shortest path to any of the goal tiles, or null if none is reachable. */
export function findPathToAny(state: GameState, from: Point, goals: readonly Point[]): Point[] | null {
  let best: Point[] | null = null;
  for (const goal of goals) {
    const p = findPath(state, from, goal);
    if (p && (best === null || p.length < best.length)) best = p;
  }
  return best;
}
