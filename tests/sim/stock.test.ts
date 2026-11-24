import { describe, expect, it } from 'vitest';
import { addStock, coldCapacity, coldFree, dryCapacity, dryFree, wasteCapacity } from '../../src/sim/stock';
import { equip, newGame } from './helpers';

describe('stock and storage', () => {
  it('starts with the stock from the design doc and the cold store nearly full', () => {
    const s = newGame();
    expect(s.stock).toEqual({ cleanFlasks: 6, dirtyFlasks: 0, media: 3, assayKits: 4, mediaPowder: 1 });
    expect(coldCapacity(s)).toBe(8);
    expect(coldFree(s)).toBe(1);
    expect(dryCapacity(s)).toBe(12);
    expect(dryFree(s)).toBe(5);
    expect(wasteCapacity(s, 'a')).toBe(8);
  });

  it('a repaired fridge holds 16', () => {
    const s = newGame();
    equip(s, 'fridge').broken = false;
    expect(coldCapacity(s)).toBe(16);
  });

  it('adds only as many as fit and never counts dirty flasks against storage', () => {
    const s = newGame();
    expect(addStock(s, 'media', 5)).toBe(1);
    expect(s.stock.media).toBe(4);
    expect(addStock(s, 'dirtyFlasks', 100)).toBe(100);
    expect(addStock(s, 'cleanFlasks', 10)).toBe(5);
    expect(dryFree(s)).toBe(0);
  });
});
