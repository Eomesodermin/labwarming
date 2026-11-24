import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/jobs';
import { contaminationChance, culturesSystem } from '../../src/sim/systems/cultures';
import type { SimEvent } from '../../src/sim/simEvents';
import { equip, newGame } from './helpers';

function growOne(state: ReturnType<typeof newGame>): 'ready' | 'contaminated' {
  state.tick = Math.max(state.tick, 100_000); // contamination waits for the first 6 minutes to pass
  const inc = equip(state, 'incubator');
  state.cultures.push({ id: `c${state.nextId++}`, incubatorId: inc.id, growTicksLeft: 1, status: 'growing' });
  const events: SimEvent[] = [];
  culturesSystem(state, events);
  const c = state.cultures.pop();
  return c?.status === 'contaminated' ? 'contaminated' : 'ready';
}

describe('contamination', () => {
  it('has a base chance of 5 percent in a clean room', () => {
    const s = newGame();
    expect(contaminationChance(s, equip(s, 'incubator'))).toBeCloseTo(0.05);
  });

  it('adds 5 percent when the room Cleanliness is below 50', () => {
    const s = newGame();
    const plot = s.plots['a'];
    if (!plot) throw new Error('no plot');
    plot.cleanliness = 49;
    expect(contaminationChance(s, equip(s, 'incubator'))).toBeCloseTo(0.1);
    plot.cleanliness = 50;
    expect(contaminationChance(s, equip(s, 'incubator'))).toBeCloseTo(0.05);
  });

  it('is halved by a tier 2 hood', () => {
    const s = newGame();
    equip(s, 'hood').tier = 2;
    expect(contaminationChance(s, equip(s, 'incubator'))).toBeCloseTo(0.025);
  });

  it('never happens in the first 6 cultures and never twice in a row', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame(seed);
      const plot = s.plots['a'];
      if (!plot) throw new Error('no plot');
      plot.cleanliness = 0; // 10 percent, so contamination is common
      const results: string[] = [];
      for (let i = 0; i < 600; i++) results.push(growOne(s));
      expect(results.slice(0, TUNING.contamination.safeCultures)).not.toContain('contaminated');
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1] === 'contaminated' && results[i] === 'contaminated').toBe(false);
      }
      expect(results).toContain('contaminated');
    }
  });

  it('is deterministic for a seed', () => {
    const run = (): string[] => {
      const s = newGame(42);
      const plot = s.plots['a'];
      if (plot) plot.cleanliness = 0;
      return Array.from({ length: 100 }, () => growOne(s));
    };
    expect(run()).toEqual(run());
  });

  it('emits events for ready and contaminated cultures', () => {
    const s = newGame(7);
    const plot = s.plots['a'];
    if (plot) plot.cleanliness = 0;
    const inc = equip(s, 'incubator');
    s.tick = 100_000;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      s.cultures.push({ id: `c${i}`, incubatorId: inc.id, growTicksLeft: 1, status: 'growing' });
      const ev: SimEvent[] = [];
      culturesSystem(s, ev);
      for (const e of ev) seen.add(e.type);
      s.cultures = [];
    }
    expect(seen.has('CultureReady')).toBe(true);
    expect(seen.has('CultureContaminated')).toBe(true);
  });
});
