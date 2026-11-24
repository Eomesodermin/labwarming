import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/sim/createState';
import { findPath, findPathToAny, pathCacheSize } from '../../src/sim/pathfinding';
import { isWalkable } from '../../src/sim/grid';
import type { Point } from '../../src/sim/types';

function assertValidPath(from: Point, path: Point[], s = createInitialState(1)): void {
  let prev = from;
  for (const p of path) {
    expect(Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y)).toBe(1);
    expect(isWalkable(s, p.x, p.y)).toBe(true);
    prev = p;
  }
}

describe('pathfinding', () => {
  it('returns an empty path to the same tile', () => {
    expect(findPath(createInitialState(1), { x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([]);
  });

  it('finds the shortest straight path', () => {
    const s = createInitialState(1);
    const p = findPath(s, { x: 5, y: 5 }, { x: 5, y: 6 });
    expect(p).toEqual([{ x: 5, y: 6 }]);
    const q = findPath(s, { x: 4, y: 4 }, { x: 7, y: 4 });
    expect(q?.length).toBe(3);
  });

  it('walks out through the Lab door into the corridor', () => {
    const s = createInitialState(1);
    const p = findPath(s, { x: 5, y: 5 }, { x: 10, y: 9 });
    expect(p).not.toBeNull();
    expect(p?.some((t) => t.x === 5 && t.y === 8)).toBe(true);
    expect(p?.length).toBe(2 + 1 + 1 + 5); // down to the door, into the corridor, then along it
    assertValidPath({ x: 5, y: 5 }, p ?? [], s);
  });

  it('goes around equipment', () => {
    const s = createInitialState(1);
    // The hood occupies (2,2) and (3,2). From (1... ) there is no direct line, so use a straight blocked line:
    // the bench is at (5,2) and (6,2); go from (4,2) to (7,2) around it.
    const p = findPath(s, { x: 4, y: 2 }, { x: 7, y: 2 });
    expect(p).not.toBeNull();
    expect(p?.length).toBe(5); // down, right x3, up
    expect(p?.some((t) => t.x === 5 && t.y === 2)).toBe(false);
    assertValidPath({ x: 4, y: 2 }, p ?? [], s);
  });

  it('returns null for unreachable goals', () => {
    const s = createInitialState(1);
    expect(findPath(s, { x: 5, y: 5 }, { x: 2, y: 2 })).toBeNull(); // inside the hood
    expect(findPath(s, { x: 5, y: 5 }, { x: 12, y: 4 })).toBeNull(); // a plot for sale
    expect(findPath(s, { x: 5, y: 5 }, { x: 0, y: 0 })).toBeNull(); // outside
    expect(findPath(s, { x: 5, y: 5 }, { x: -1, y: 5 })).toBeNull(); // off the map
  });

  it('returns null when the Lab is walled in', () => {
    const s = createInitialState(1);
    // Block the door approach with a fake piece of equipment.
    s.equipment['block'] = { id: 'block', defId: 'sink', tier: 1, x: 5, y: 7, rot: 2, broken: false, cycle: null };
    s.gridVersion += 1;
    expect(findPath(s, { x: 5, y: 5 }, { x: 10, y: 9 })).toBeNull();
    // Unless the door is reached from another tile: (5,7) is the only tile inside the door.
    expect(findPath(s, { x: 5, y: 5 }, { x: 5, y: 6 })).not.toBeNull();
  });

  it('is deterministic', () => {
    const a = findPath(createInitialState(1), { x: 3, y: 5 }, { x: 25, y: 10 });
    const b = findPath(createInitialState(2), { x: 3, y: 5 }, { x: 25, y: 10 });
    expect(a).toEqual(b);
  });

  it('caches paths and clears the cache when the grid version changes', () => {
    const s = createInitialState(1);
    expect(pathCacheSize(s)).toBe(0);
    const first = findPath(s, { x: 5, y: 5 }, { x: 10, y: 9 });
    expect(pathCacheSize(s)).toBe(1);
    const again = findPath(s, { x: 5, y: 5 }, { x: 10, y: 9 });
    expect(again).toEqual(first);
    expect(again).not.toBe(first); // callers get a copy they may mutate
    findPath(s, { x: 5, y: 5 }, { x: 6, y: 5 });
    expect(pathCacheSize(s)).toBe(2);
    s.gridVersion += 1;
    expect(pathCacheSize(s)).toBe(0);
  });

  it('sees a changed grid after the version bump', () => {
    const s = createInitialState(1);
    const before = findPath(s, { x: 4, y: 5 }, { x: 6, y: 5 });
    expect(before?.length).toBe(2);
    s.equipment['wall'] = { id: 'wall', defId: 'sink', tier: 1, x: 5, y: 5, rot: 0, broken: false, cycle: null };
    expect(findPath(s, { x: 4, y: 5 }, { x: 6, y: 5 })?.length).toBe(2); // stale cache, as designed
    s.gridVersion += 1;
    expect(findPath(s, { x: 4, y: 5 }, { x: 6, y: 5 })?.length).toBe(4);
  });

  it('picks the nearest of several goals', () => {
    const s = createInitialState(1);
    const p = findPathToAny(s, { x: 3, y: 4 }, [
      { x: 8, y: 6 },
      { x: 3, y: 3 },
    ]);
    expect(p).toEqual([{ x: 3, y: 3 }]);
    expect(findPathToAny(s, { x: 3, y: 4 }, [{ x: 2, y: 2 }])).toBeNull();
  });
});
