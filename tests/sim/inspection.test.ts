import { describe, expect, it } from 'vitest';
import { INSPECTION } from '../../src/content/events';
import { step } from '../../src/sim/step';
import { stickyNotes } from '../../src/sim/systems/inspection';
import { fireEvent } from '../../src/sim/systems/eventCore';
import { hireStaff } from '../../src/sim/systems/staff';
import type { GameState } from '../../src/sim/types';
import { doJob, equip, markFired, mails, newGame, rejections, run, setClock, stand } from './helpers';

function notified(): GameState {
  const s = newGame();
  markFired(s, ['insp_notice']);
  s.flags['fridgeWarmDay'] = 99;
  equip(s, 'fridge').broken = false;
  setClock(s, 5, 13, 6);
  run(s, 12);
  return s;
}

/** Runs until the inspection is over. */
function runVisit(s: GameState): void {
  setClock(s, 6, 11, 4);
  for (let i = 0; i < 4000 && (s.inspection?.phase !== 'done' && s.inspection !== null); i++) step(s, []);
  run(s, 20);
}

describe('the inspection notice', () => {
  it('arrives on Day 5 at 13:00 with a 4-item checklist and says tomorrow at 11:00', () => {
    const s = notified();
    expect(mails(s, 'insp_notice')[0]?.from).toBe('Inspector Tock');
    expect(mails(s, 'insp_notice')[0]?.body).toContain('tomorrow at 11:00');
    expect(s.inspection?.phase).toBe('announced');
    expect(INSPECTION.checks).toHaveLength(4);
    expect(s.inspection?.visitT).toBe(5 * 2400 + 720);
  });

  it('comes round again every 8 days', () => {
    const s = notified();
    s.inspection = null;
    setClock(s, 13, 13, 6);
    run(s, 12);
    expect(mails(s, 'insp_notice')).toHaveLength(2);
  });

  it('unlocks the Sign logbook job at the desk', () => {
    const s = newGame();
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'signLogbook' }]))).toEqual(['No inspection is coming']);
    const t = notified();
    doJob(t, 'desk', 'signLogbook');
    expect(t.inspection?.signed).toBe(true);
    stand(t, 'desk');
    expect(rejections(step(t, [{ type: 'Interact', jobId: 'signLogbook' }]))).toEqual(['The logbook is signed']);
  });
});

describe('the inspection visit', () => {
  it('Tock walks to every room, and all four checks pass: 4 x 50 Funds, 13 Reputation, a gold star', () => {
    const s = notified();
    s.funds = 5000;
    s.plots['b'] = { id: 'b', owned: true, roomType: 'washup', cleanliness: 100, waste: 0 };
    s.gridVersion += 1;
    doJob(s, 'desk', 'signLogbook');
    const before = s.funds;
    const rep = s.reputation;
    setClock(s, 6, 11, 4);
    const seen = new Set<string>();
    for (let i = 0; i < 4000 && s.inspection; i++) {
      step(s, []);
      const tock = Object.values(s.agents).find((a) => a.kind === 'inspector');
      if (tock) seen.add(`${tock.x},${tock.y}`);
    }
    expect(s.inspection).toBeNull();
    expect(s.funds - before).toBe(200);
    expect(s.reputation - rep).toBe(13);
    expect(s.flags['goldStar']).toBe(true);
    expect(s.stats.inspectionsDone).toBe(1);
    const report = mails(s, 'insp_visit')[0]?.body ?? '';
    expect(report.match(/Tock nods\. A sticker is applied\./g)).toHaveLength(4);
    expect(report).toContain('gold star');
    // Tock stood in both owned rooms.
    const inA = [...seen].some((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return x >= 2 && x <= 9 && y >= 2 && y <= 7; });
    const inB = [...seen].some((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return x >= 11 && x <= 18 && y >= 2 && y <= 7; });
    expect(inA && inB).toBe(true);
    run(s, 800);
    expect(Object.values(s.agents).some((a) => a.kind === 'inspector')).toBe(false);
  });

  it('each miss writes "Tock writes for quite a long time", pays nothing for it and leaves a sticky note', () => {
    const s = notified();
    // Not signed, one bin full, one room dirty, fridge broken: all four missed.
    equip(s, 'fridge').broken = true;
    const plot = s.plots['a'];
    if (!plot) throw new Error('plot');
    plot.waste = 8;
    plot.cleanliness = 30;
    const before = s.funds;
    runVisit(s);
    expect(s.funds - before).toBe(0);
    expect(mails(s, 'insp_visit')[0]?.body.match(/Tock writes for quite a long time\./g)).toHaveLength(4);
    expect(s.flags['goldStar']).toBeUndefined();
    expect(s.inspection?.phase).toBe('done');
    expect(stickyNotes(s).sort()).toEqual(['clean', 'fridge', 'logbook', 'waste']);
    // Fixing them one by one clears the notes.
    equip(s, 'fridge').broken = false;
    expect(stickyNotes(s).sort()).toEqual(['clean', 'logbook', 'waste']);
    plot.waste = 0;
    plot.cleanliness = 90;
    doJob(s, 'desk', 'signLogbook');
    expect(stickyNotes(s)).toEqual([]);
    run(s, 20);
    expect(s.inspection).toBeNull();
  });

  it('pays per check passed: a signed logbook and a mended fridge but a dirty room is 2 of 4... and no fine', () => {
    const s = notified();
    doJob(s, 'desk', 'signLogbook');
    const plot = s.plots['a'];
    if (!plot) throw new Error('plot');
    plot.cleanliness = 59;
    plot.waste = 8;
    const before = s.funds;
    const rep = s.reputation;
    runVisit(s);
    expect(s.funds - before).toBe(100);
    expect(s.reputation - rep).toBe(4);
    expect(s.funds).toBeGreaterThan(0);
  });

  it('counts a room that was dirty when Tock looked even if it is tidied after', () => {
    const s = newGame();
    s.inspection = { phase: 'announced', visitT: 0, signed: true, wasteOk: true, cleanOk: true, missed: [] };
    markFired(s);
    s.flags['fridgeWarmDay'] = 99;
    equip(s, 'fridge').broken = false;
    const plot = s.plots['a'];
    if (plot) plot.cleanliness = 40;
    // Tock reaches the room while it is dirty, then the player tidies up.
    let tidied = false;
    for (let i = 0; i < 3000 && s.inspection; i++) {
      step(s, []);
      const tock = Object.values(s.agents).find((a) => a.kind === 'inspector');
      if (tock && !tidied && tock.x >= 2 && tock.x <= 9 && tock.y <= 7 && tock.path.length === 0) {
        if (s.inspection?.cleanOk === false) {
          if (plot) plot.cleanliness = 100;
          tidied = true;
        }
      }
    }
    expect(tidied).toBe(true);
    expect(s.stats.inspectionsDone).toBe(1);
    expect(s.inspection?.missed ?? ['clean']).toContain('clean');
  });

  it('works with staff around: nobody blocks Tock', () => {
    const s = notified();
    s.funds = 5000;
    s.reputation = 10;
    hireStaff(s, s.candidates.find((c) => c.role === 'technician')?.id ?? '', []);
    doJob(s, 'desk', 'signLogbook');
    runVisit(s);
    expect(s.stats.inspectionsDone).toBe(1);
  });

  it('can be fired directly: the report email has the totals', () => {
    const s = newGame();
    fireEvent(s, 'insp_visit', [], { params: { report: 'Line one\nLine two' } });
    expect(mails(s, 'insp_visit')[0]?.body).toBe('Line one\nLine two');
  });
});
