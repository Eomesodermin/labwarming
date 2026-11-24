import { describe, expect, it } from 'vitest';
import { fireEvent } from '../../src/sim/systems/eventCore';
import { computeMood, hireStaff } from '../../src/sim/systems/staff';
import type { GameState } from '../../src/sim/types';
import { doJob, equip, markFired, mails, newGame, run, setClock, stand } from './helpers';

function withStaff(): { s: GameState; id: string } {
  const s = newGame();
  s.funds = 5000;
  s.reputation = 10;
  markFired(s);
  s.flags['fridgeWarmDay'] = 99;
  hireStaff(s, s.candidates.find((c) => c.role === 'technician')?.id ?? '', []);
  const a = Object.values(s.agents).find((x) => x.staff);
  if (!a?.staff) throw new Error('staff');
  a.staff.trait = 'tidy';
  return { s, id: a.id };
}

describe('pi_walkthrough', () => {
  function visit(clean: number): GameState {
    const s = newGame();
    markFired(s);
    s.flags['fridgeWarmDay'] = 99;
    s.reputation = 20;
    const plot = s.plots['a'];
    if (plot) plot.cleanliness = clean;
    fireEvent(s, 'pi_walkthrough', []);
    return s;
  }

  it('Quince and a guest walk through the Lab; a clean Lab gives +3 Reputation', () => {
    const s = visit(80);
    run(s, 400);
    expect(Object.values(s.agents).map((a) => a.kind).sort()).toEqual(['pi', 'player', 'visitor']);
    run(s, 900);
    expect(s.reputation).toBe(23);
    expect(Object.values(s.agents).map((a) => a.kind)).toEqual(['player']);
  });

  it('a messy Lab is "charmingly lived-in" with no penalty', () => {
    const s = visit(50);
    const events = run(s, 1300);
    expect(s.reputation).toBe(20);
    expect(events.some((e) => e.type === 'Toast' && e.text === 'Charmingly lived-in.')).toBe(true);
  });
});

describe('admin_fire_test', () => {
  it('staff walk outside and wait, keep their job progress, get +5 Mood, then go back', () => {
    const { s, id } = withStaff();
    const agent = s.agents[id];
    if (!agent?.staff) throw new Error('agent');
    s.stock.dirtyFlasks = 1;
    run(s, 200);
    const job = agent.jobId ? s.jobs[agent.jobId] : undefined;
    const progress = job?.progressTicks ?? 0;
    const base = computeMood(s, agent);
    fireEvent(s, 'admin_fire_test', []);
    expect(computeMood(s, agent)).toBe(base + 5);
    run(s, 100);
    expect(agent.y).toBe(10);
    expect(agent.path).toHaveLength(0);
    if (job && s.jobs[job.id]) expect(s.jobs[job.id]?.progressTicks).toBe(progress);
    expect(s.director.drill).not.toBeNull();
    run(s, 200);
    expect(s.director.drill).toBeNull();
    run(s, 600);
    expect(agent.y).not.toBe(10);
  });
});

describe('admin_seminar_pizza', () => {
  it('gives everyone full Energy', () => {
    const { s, id } = withStaff();
    const agent = s.agents[id];
    if (agent?.staff) agent.staff.energy = 25;
    fireEvent(s, 'admin_seminar_pizza', []);
    expect(agent?.staff?.energy).toBe(100);
  });
});

describe('admin_waste_rules', () => {
  it('makes taking out waste 3 s longer until 18:00, then sends "The memo has been withdrawn."', () => {
    const s = newGame();
    markFired(s);
    s.flags['fridgeWarmDay'] = 99;
    const plot = s.plots['a'];
    if (plot) plot.waste = 3;
    setClock(s, 7, 9);
    fireEvent(s, 'admin_waste_rules', []);
    stand(s, 'bin');
    run(s, 1, [{ type: 'Interact', jobId: 'takeOutWaste' }]);
    const job = Object.values(s.jobs)[0];
    expect(job?.totalTicks).toBe(70);
    run(s, 80);
    expect(plot?.waste).toBe(0);
    expect(mails(s, 'admin_waste_rules_end')).toHaveLength(0);
    s.clock.tickOfDay = 2395;
    run(s, 10);
    expect(mails(s, 'admin_waste_rules_end')[0]?.body).toBe('The memo has been withdrawn.');
    if (plot) plot.waste = 3;
    stand(s, 'bin');
    doJob(s, 'bin', 'takeOutWaste');
    expect(equip(s, 'bin').id).toBeDefined();
  });
});
