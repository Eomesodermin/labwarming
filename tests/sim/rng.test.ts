import { describe, expect, it } from 'vitest';
import { chance, mulberry32, nextFloat, nextInt, seedToState } from '../../src/sim/rng';
import { createInitialState } from '../../src/sim/createState';

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    const sa = Array.from({ length: 50 }, () => nextFloat(a));
    const sb = Array.from({ length: 50 }, () => nextFloat(b));
    expect(sa).toEqual(sb);
  });

  it('gives different sequences for different seeds', () => {
    const a = createInitialState(1);
    const b = createInitialState(2);
    expect(nextFloat(a)).not.toBe(nextFloat(b));
  });

  it('stays in [0, 1) and in integer bounds', () => {
    const s = createInitialState(7);
    for (let i = 0; i < 2000; i++) {
      const f = nextFloat(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(s, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it('keeps all of its state in GameState, so it can be resumed', () => {
    const a = createInitialState(9);
    for (let i = 0; i < 10; i++) nextFloat(a);
    const resumed = createInitialState(9);
    resumed.rngState = a.rngState;
    expect(nextFloat(resumed)).toBe(nextFloat(a));
  });

  it('is a pure function of its input state', () => {
    expect(mulberry32(123)).toEqual(mulberry32(123));
    expect(seedToState(5)).toBe(seedToState(5));
  });

  it('chance respects the extremes and is roughly fair', () => {
    const s = createInitialState(3);
    expect(chance(s, 0)).toBe(false);
    expect(chance(s, 1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (chance(s, 0.25)) hits++;
    expect(hits).toBeGreaterThan(850);
    expect(hits).toBeLessThan(1150);
  });
});
