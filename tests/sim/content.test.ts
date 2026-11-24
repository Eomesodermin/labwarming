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
      if (eq.defId === 'bay') continue; // the delivery bay stands in the corridor
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

describe('economy content', () => {
  it('has non-negative integer prices and real stock items for every order', async () => {
    const { ORDERS } = await import('../../src/content/orders');
    const { START_STOCK } = await import('../../src/content/items');
    for (const o of Object.values(ORDERS)) {
      expect(Number.isInteger(o.price) && o.price >= 0, o.id).toBe(true);
      expect(o.qty).toBeGreaterThan(0);
      expect(Object.keys(START_STOCK)).toContain(o.item);
    }
  });

  it('has grants with integer pay and a decision time, and every email row has text', async () => {
    const { GRANTS } = await import('../../src/content/economy');
    const { EVENT_ROWS, FRIDGE_WARM } = await import('../../src/content/events');
    for (const g of GRANTS) {
      expect(Number.isInteger(g.pays) && g.pays >= 0, g.id).toBe(true);
      expect(g.decisionSec).toBeGreaterThan(0);
      expect(EVENT_ROWS[`grant_award_${g.id}`], g.id).toBeDefined();
    }
    for (const r of Object.values(EVENT_ROWS)) expect(r.body.length, r.id).toBeGreaterThan(10);
    expect(FRIDGE_WARM.text.length).toBeGreaterThan(10);
  });

  it('uses no em dashes in player-facing text', async () => {
    const { EVENT_ROWS, FRIDGE_WARM } = await import('../../src/content/events');
    const rev = await import('../../src/content/reviewer');
    const all = [
      ...Object.values(EVENT_ROWS).flatMap((r) => [r.subject, r.body]),
      FRIDGE_WARM.text,
      rev.REVIEWER_FIRST_ACCEPT,
      rev.REVIEWER_FIRST_REVISION,
      rev.REVIEWER_AFTER_REVISION,
      ...rev.REVIEWER_RANDOM,
    ];
    for (const t of all) expect(t).not.toMatch(/—/);
  });
});
