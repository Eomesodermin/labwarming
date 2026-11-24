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
    expect(TODO_STEPS).toHaveLength(14);
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
    const { EVENTS } = await import('../../src/content/events');
    for (const g of GRANTS) {
      expect(Number.isInteger(g.pays) && g.pays >= 0, g.id).toBe(true);
      expect(g.decisionSec).toBeGreaterThan(0);
    }
    for (const r of Object.values(EVENTS)) if (!r.silent) expect(r.body.length, r.id).toBeGreaterThan(5);
  });

  it('uses no em dashes in player-facing text', async () => {
    const { EVENTS, REQUESTS } = await import('../../src/content/events');
    const rev = await import('../../src/content/reviewer');
    const all = [
      ...Object.values(EVENTS).flatMap((r) => [r.subject, r.body, ...(r.choices ?? []).flatMap((c) => [c.label, c.reply ?? ''])]),
      ...Object.values(REQUESTS).flatMap((r) => [r.label, r.doneText, r.missText]),
      rev.REVIEWER_FIRST_ACCEPT,
      rev.REVIEWER_FIRST_REVISION,
      rev.REVIEWER_AFTER_REVISION,
      ...rev.REVIEWER_RANDOM,
    ];
    for (const t of all) expect(t).not.toMatch(/\u2014/);
  });
});

describe('event content', () => {
  it('has every event id referenced by a beat, an effect, a later effect or a request', async () => {
    const { EVENTS, SCRIPTED_BEATS, REQUESTS } = await import('../../src/content/events');
    const { GRANTS } = await import('../../src/content/economy');
    type Fx = { type: string; event?: string; then?: Fx[]; otherwise?: Fx[] };
    const visit = (list: Fx[], f: (e: Fx) => void): void => {
      for (const e of list) {
        f(e);
        visit(e.then ?? [], f);
        visit(e.otherwise ?? [], f);
      }
    };
    for (const def of Object.values(EVENTS)) {
      expect(def.id).toBe(Object.keys(EVENTS).find((k) => EVENTS[k] === def));
      visit((def.effects ?? []) as Fx[], (e) => {
        if (e.type === 'later') expect(EVENTS[e.event ?? ''], `${def.id} -> ${e.event}`).toBeDefined();
      });
      for (const c of def.choices ?? []) visit(c.effects as Fx[], (e) => {
        if (e.type === 'later') expect(EVENTS[e.event ?? ''], def.id).toBeDefined();
      });
      if (def.request) expect(REQUESTS[def.request], def.id).toBeDefined();
      if (def.pool) expect(def.pool.weight).toBeGreaterThan(0);
    }
    for (const b of SCRIPTED_BEATS) {
      expect(EVENTS[b.event], b.key).toBeDefined();
      const gid = b.params?.['grantId'];
      if (gid) expect(GRANTS.some((g) => g.id === gid), b.key).toBe(true);
    }
    for (const g of GRANTS.filter((x) => x.deadlineDay !== null)) {
      expect(SCRIPTED_BEATS.some((b) => b.params?.['grantId'] === g.id), g.id).toBe(true);
    }
  });

  it('has text, integer money and sane numbers in every event and request', async () => {
    const { EVENTS, REQUESTS, FAILURES, INSPECTION, DIRECTOR } = await import('../../src/content/events');
    for (const def of Object.values(EVENTS)) {
      expect(def.from.length, def.id).toBeGreaterThan(0);
      if (!def.silent) {
        expect(def.subject.length, def.id).toBeGreaterThan(0);
        expect(def.body.length, def.id).toBeGreaterThan(0);
      }
    }
    for (const r of Object.values(REQUESTS)) {
      expect(r.needs.length).toBeGreaterThan(0);
      expect(Number.isInteger(r.missFunds) && r.missFunds >= 0).toBe(true);
      expect(r.withinDays !== undefined || r.nextDayEnd === true, r.id).toBe(true);
    }
    expect(Number.isInteger(INSPECTION.passFunds) && INSPECTION.passFunds >= 0).toBe(true);
    expect(FAILURES.autoclave.chancePerCycle).toBeLessThan(1);
    expect(DIRECTOR.noFailureSec).toBe(360);
    expect(DIRECTOR.randomGapSec).toBe(90);
    expect(DIRECTOR.failureGapSec).toBe(120);
  });

  it('keeps Quince in character: her emails are signed and she believes in afternoons', async () => {
    const { EVENTS, withSignoff, PI_NAME } = await import('../../src/content/events');
    for (const def of Object.values(EVENTS).filter((d) => d.from === PI_NAME && !d.silent)) {
      expect(withSignoff(def, def.body)).toMatch(/Best, W\nSent from my phone$/);
    }
  });
});
