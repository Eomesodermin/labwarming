import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_ROWS, MAP_W, PLOTS } from '../../src/content/map';
import { createInitialState } from '../../src/sim/createState';
import { baseTile, equipmentAt, footprintTiles, frontTiles, isWalkable } from '../../src/sim/grid';

describe('grid', () => {
  it('parses a 30 by 20 map', () => {
    expect(MAP_ROWS.length).toBe(MAP_H);
    for (const row of MAP_ROWS) expect(row.length).toBe(MAP_W);
  });

  it('puts every plot door in a wall row, matching its plot', () => {
    for (const p of PLOTS) {
      const t = baseTile(p.door.x, p.door.y);
      expect(t.kind).toBe('door');
      expect(t.plotId).toBe(p.id);
      expect(baseTile(p.x, p.y).plotId).toBe(p.id);
      expect(baseTile(p.x + p.w - 1, p.y + p.h - 1).plotId).toBe(p.id);
    }
  });

  it('opens only the starting Lab', () => {
    const s = createInitialState(1);
    expect(isWalkable(s, 5, 5)).toBe(true);
    expect(isWalkable(s, 5, 8)).toBe(true); // the Lab door
    expect(isWalkable(s, 14, 8)).toBe(false); // a closed door
    expect(isWalkable(s, 12, 4)).toBe(false); // plot b is for sale
    expect(isWalkable(s, 5, 9)).toBe(true); // corridor
    expect(isWalkable(s, 1, 9)).toBe(true); // entrance
    expect(isWalkable(s, 0, 9)).toBe(false); // outside
    expect(isWalkable(s, 1, 4)).toBe(false); // wall
  });

  it('blocks equipment footprints, including rotated ones', () => {
    const s = createInitialState(1);
    expect(isWalkable(s, 2, 2)).toBe(false); // hood, left half
    expect(isWalkable(s, 3, 2)).toBe(false); // hood, right half
    expect(isWalkable(s, 9, 4)).toBe(false); // shelf rotated to 1 by 2
    expect(isWalkable(s, 9, 5)).toBe(false);
    expect(isWalkable(s, 8, 4)).toBe(true); // in front of the shelf
    expect(isWalkable(s, 4, 3)).toBe(true);
  });

  it('keeps every use tile and the door approach free', () => {
    const s = createInitialState(1);
    for (const eq of Object.values(s.equipment)) {
      for (const t of frontTiles(eq)) expect(isWalkable(s, t.x, t.y), `${eq.defId} front ${t.x},${t.y}`).toBe(true);
    }
    expect(isWalkable(s, 5, 7)).toBe(true);
  });

  it('finds the equipment at a tile', () => {
    const s = createInitialState(1);
    expect(equipmentAt(s, 3, 2)?.defId).toBe('hood');
    expect(equipmentAt(s, 9, 5)?.defId).toBe('shelf');
    expect(equipmentAt(s, 5, 5)).toBeNull();
  });

  it('computes front tiles for each rotation', () => {
    const eq = { id: 'x', defId: 'bench', tier: 1, x: 5, y: 5, rot: 0 as const, broken: false };
    expect(frontTiles(eq)).toEqual([{ x: 5, y: 6 }, { x: 6, y: 6 }]);
    expect(frontTiles({ ...eq, rot: 2 })).toEqual([{ x: 5, y: 4 }, { x: 6, y: 4 }]);
    expect(footprintTiles({ ...eq, rot: 1 })).toEqual([{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    expect(frontTiles({ ...eq, rot: 1 })).toEqual([{ x: 4, y: 5 }, { x: 4, y: 6 }]);
    expect(frontTiles({ ...eq, rot: 3 })).toEqual([{ x: 6, y: 5 }, { x: 6, y: 6 }]);
  });

  it('re-reads walkability when the grid version changes', () => {
    const s = createInitialState(1);
    expect(isWalkable(s, 12, 4)).toBe(false);
    s.plots['b'] = { id: 'b', owned: true, roomType: 'lab', cleanliness: 100 };
    expect(isWalkable(s, 12, 4)).toBe(false); // cached until the version moves
    s.gridVersion += 1;
    expect(isWalkable(s, 12, 4)).toBe(true);
  });
});
