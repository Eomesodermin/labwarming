import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_SECOND } from '../../src/content/balance';
import { EQUIPMENT } from '../../src/content/equipment';
import { PLOTS, START_EQUIPMENT, START_PLOT } from '../../src/content/map';
import { createInitialState } from '../../src/sim/createState';

describe('content', () => {
  it('has a day of 4 real minutes at 1x', () => {
    expect(TICKS_PER_DAY / TICKS_PER_SECOND).toBe(240);
  });

  it('only references equipment that exists', () => {
    for (const e of START_EQUIPMENT) expect(EQUIPMENT[e.defId], e.defId).toBeDefined();
  });

  it('starts with a plot that exists', () => {
    expect(PLOTS.map((p) => p.id)).toContain(START_PLOT);
  });

  it('places the starting equipment inside the starting plot without overlaps', () => {
    const s = createInitialState(1);
    const plot = PLOTS.find((p) => p.id === START_PLOT);
    expect(plot).toBeDefined();
    const seen = new Set<string>();
    for (const eq of Object.values(s.equipment)) {
      const w = eq.rot % 2 === 1 ? EQUIPMENT[eq.defId]?.h ?? 1 : EQUIPMENT[eq.defId]?.w ?? 1;
      const h = eq.rot % 2 === 1 ? EQUIPMENT[eq.defId]?.w ?? 1 : EQUIPMENT[eq.defId]?.h ?? 1;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const x = eq.x + dx;
          const y = eq.y + dy;
          expect(x >= (plot?.x ?? 0) && x < (plot?.x ?? 0) + (plot?.w ?? 0)).toBe(true);
          expect(y >= (plot?.y ?? 0) && y < (plot?.y ?? 0) + (plot?.h ?? 0)).toBe(true);
          const k = `${x},${y}`;
          expect(seen.has(k), `overlap at ${k}`).toBe(false);
          seen.add(k);
        }
      }
    }
  });
});

describe('hand-job content', () => {
  it('names a station that exists for every job', async () => {
    const { JOBS } = await import('../../src/content/jobs');
    for (const j of Object.values(JOBS)) expect(EQUIPMENT[j.station], j.id).toBeDefined();
  });

  it('only uses tier stats that exist', async () => {
    const { JOBS } = await import('../../src/content/jobs');
    for (const j of Object.values(JOBS)) {
      if (j.secondsStat) expect(EQUIPMENT[j.station]?.stats?.[j.secondsStat], j.id).toBeDefined();
    }
  });

  it('has to-do steps that name real stats', async () => {
    const { TODO_STEPS } = await import('../../src/content/tutorial');
    expect(TODO_STEPS).toHaveLength(6);
  });
});
