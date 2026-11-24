import { describe, expect, it } from 'vitest';
import { DIRECTOR } from '../../src/content/events';
import { MOOD } from '../../src/content/staff';
import { applyForGrant, grantBlocker, openGrant } from '../../src/sim/systems/grants';
import { step } from '../../src/sim/step';
import { computeMood, hireStaff } from '../../src/sim/systems/staff';
import type { GameState } from '../../src/sim/types';
import { doJob, markFired, mails, newGame, rejections, run, setClock, stand } from './helpers';

function twoPapersAndSlides(s: GameState): void {
  s.papers.push({ id: 'p1', number: 1, status: 'accepted', reviewTicksLeft: 0 }, { id: 'p2', number: 2, status: 'accepted', reviewTicksLeft: 0 });
  s.presentations = 1;
}

function announced(): GameState {
  const s = newGame();
  markFired(s, ['grant_announce_equipment']);
  setClock(s, 3, 9, 6);
  run(s, 12);
  return s;
}

describe('the Equipment Call', () => {
  it('is announced on Day 3 with a deadline of Day 5 at 17:00 and needs 2 papers and a presentation', () => {
    const s = announced();
    expect(s.grantCalls['equipment']).toEqual({ announced: true, deadlineDay: 5, payPercent: 100, crashes: 0 });
    s.grants['seedling'] = { status: 'awarded', decisionTicksLeft: 0 };
    expect(grantBlocker(s)).toBe('Departmental Equipment Call needs 2 accepted papers');
    s.papers.push({ id: 'p1', number: 1, status: 'accepted', reviewTicksLeft: 0 }, { id: 'p2', number: 2, status: 'accepted', reviewTicksLeft: 0 });
    expect(grantBlocker(s)).toBe('Departmental Equipment Call needs 1 presentation');
    s.presentations = 1;
    expect(grantBlocker(s)).toBeNull();
    expect(openGrant(s)?.id).toBe('equipment');
  });

  it('is not open before the announcement', () => {
    const s = newGame();
    s.grants['seedling'] = { status: 'awarded', decisionTicksLeft: 0 };
    twoPapersAndSlides(s);
    expect(grantBlocker(s)).toBe('Every open grant has an application in');
  });

  it('writes the call with the sooner deadline first, even when Seedling is still open', () => {
    const s = announced();
    twoPapersAndSlides(s);
    expect(openGrant(s)?.id).toBe('equipment');
  });

  it('nags at 09:00 on Day 4 and Day 5, and not once the application is in', () => {
    const s = announced();
    markFired(s);
    setClock(s, 4, 9, 6);
    run(s, 12);
    expect(mails(s, 'grant_nag')).toHaveLength(1);
    expect(mails(s, 'grant_nag')[0]?.body).toContain('I have told the Dean it is basically submitted.');
    run(s, 100);
    expect(mails(s, 'grant_nag')).toHaveLength(1);
    setClock(s, 5, 9, 6);
    run(s, 12);
    expect(mails(s, 'grant_nag')).toHaveLength(2);
    const t = announced();
    markFired(t);
    t.grants['equipment'] = { status: 'applied', decisionTicksLeft: 9999 };
    setClock(t, 4, 9, 6);
    run(t, 12);
    expect(mails(t, 'grant_nag')).toHaveLength(0);
  });

  it('applied before the deadline: pays 2,000 and 5 Reputation, then Quince brings cake', () => {
    const s = announced();
    markFired(s);
    s.grants['seedling'] = { status: 'awarded', decisionTicksLeft: 0 };
    twoPapersAndSlides(s);
    setClock(s, 5, 15);
    doJob(s, 'desk', 'writeGrant');
    expect(s.grants['equipment']?.status).toBe('applied');
    const before = s.funds;
    run(s, 305);
    expect(s.funds).toBe(before + 2000);
    expect(s.reputation).toBe(5);
    const award = mails(s, 'grant_award')[0];
    expect(award?.from).toBe('Departmental Office');
    expect(award?.body).toContain('+2000 Funds');
    // 20 s later the cake email arrives and Quince walks in.
    expect(mails(s, 'pi_cake')).toHaveLength(0);
    run(s, DIRECTOR.cakeDelaySec * 10);
    expect(mails(s, 'pi_cake')).toHaveLength(1);
    expect(Object.values(s.agents).some((a) => a.kind === 'pi')).toBe(true);
  });

  it('an application sent before the deadline stops the portal crash', () => {
    const s = announced();
    markFired(s);
    s.grants['equipment'] = { status: 'applied', decisionTicksLeft: 99999 };
    setClock(s, 5, 17, 3);
    run(s, 20);
    expect(s.grantCalls['equipment']?.deadlineDay).toBe(5);
    expect(mails(s, 'grant_portal_crash')).toHaveLength(0);
  });

  it('letting the deadline pass crashes the portal: one more day and 80 percent pay, repeatedly, never lost', () => {
    const s = announced();
    markFired(s);
    setClock(s, 5, 17, 3);
    run(s, 10);
    expect(mails(s, 'grant_portal_crash')).toHaveLength(1);
    expect(mails(s, 'grant_portal_crash')[0]?.body).toContain('The deadline has moved to tomorrow');
    expect(mails(s, 'grant_portal_crash')[0]?.body).toContain('Day 6 at 17:00');
    expect(s.grantCalls['equipment']).toMatchObject({ deadlineDay: 6, payPercent: 80, crashes: 1 });
    setClock(s, 6, 17, 3);
    run(s, 10);
    expect(s.grantCalls['equipment']).toMatchObject({ deadlineDay: 7, payPercent: 80, crashes: 2 });
    // The late application pays 80 percent.
    s.grants['seedling'] = { status: 'awarded', decisionTicksLeft: 0 };
    twoPapersAndSlides(s);
    applyForGrant(s, openGrant(s) as NonNullable<ReturnType<typeof openGrant>>, []);
    run(s, 305);
    expect(mails(s, 'grant_award')[0]?.body).toContain('+1600 Funds');
    expect(mails(s, 'grant_award')[0]?.body).not.toContain('+2000');
  });

  it('shows no portal crash for the Seedling Grant, which has no deadline', () => {
    const s = newGame();
    markFired(s);
    setClock(s, 9, 17, 3);
    run(s, 10);
    expect(mails(s, 'grant_portal_crash')).toHaveLength(0);
  });
});

describe('the Foundation Grant', () => {
  it('is announced on Day 6 with a deadline of Day 10, and needs 4 papers and Reputation 60', () => {
    const s = newGame();
    markFired(s, ['grant_announce_foundation']);
    setClock(s, 6, 9, 6);
    run(s, 12);
    expect(s.grantCalls['foundation']).toMatchObject({ announced: true, deadlineDay: 10 });
    s.grants['seedling'] = { status: 'awarded', decisionTicksLeft: 0 };
    s.grants['equipment'] = { status: 'awarded', decisionTicksLeft: 0 };
    s.grantCalls['equipment'] = { announced: true, deadlineDay: 5, payPercent: 100, crashes: 0 };
    for (let i = 1; i <= 4; i++) s.papers.push({ id: `p${i}`, number: i, status: 'accepted', reviewTicksLeft: 0 });
    expect(grantBlocker(s)).toBe('Foundation Project Grant needs Reputation 60');
    s.reputation = 60;
    expect(grantBlocker(s)).toBeNull();
    const before = s.funds;
    stand(s, 'desk');
    step(s, [{ type: 'Interact', jobId: 'writeGrant' }]);
    run(s, 210 + 305);
    expect(s.funds).toBeGreaterThanOrEqual(before + 4000);
  });

  it('nags on Day 9 and Day 10, and crashes on Day 10 at 17:00', () => {
    const s = newGame();
    markFired(s);
    s.grantCalls['foundation'] = { announced: true, deadlineDay: 10, payPercent: 100, crashes: 0 };
    setClock(s, 9, 9, 6);
    run(s, 12);
    setClock(s, 10, 9, 6);
    run(s, 12);
    expect(mails(s, 'grant_nag')).toHaveLength(2);
    setClock(s, 10, 17, 3);
    run(s, 10);
    expect(s.grantCalls['foundation']).toMatchObject({ deadlineDay: 11, payPercent: 80 });
  });
});

describe('cake', () => {
  function bakery(): { s: GameState; id: string } {
    const s = newGame();
    s.funds = 5000;
    s.reputation = 10;
    const cand = s.candidates.find((c) => c.role === 'technician');
    hireStaff(s, cand?.id ?? '', []);
    const agent = Object.values(s.agents).find((a) => a.staff);
    if (!agent?.staff) throw new Error('no staff');
    agent.staff.trait = 'tidy';
    agent.staff.energy = 30;
    return { s, id: agent.id };
  }

  it('Quince walks in, stands at the cake, and everyone is rested with +20 Mood for 60 s', () => {
    const { s, id } = bakery();
    const agent = s.agents[id];
    if (!agent) throw new Error('agent');
    markFired(s);
    s.flags['fridgeWarmDay'] = 1;
    // fire the cake email
    s.director.queue.push({ atT: 0, eventId: 'pi_cake' });
    run(s, 2);
    const quince = Object.values(s.agents).find((a) => a.kind === 'pi');
    expect(quince).toBeDefined();
    expect(s.flags['cakeTicks']).toBeUndefined();
    run(s, 200);
    expect(s.flags['cakeTicks']).toBeGreaterThan(0);
    expect(s.director.cake).toEqual({ x: 6, y: 10 });
    expect(agent.staff?.energy).toBeGreaterThanOrEqual(95);
    const withCake = computeMood(s, agent);
    expect(agent.staff?.mood).toBe(withCake);
    run(s, 620);
    expect(s.flags['cakeTicks']).toBe(0);
    expect(s.director.cake).toBeNull();
    expect(withCake - computeMood(s, agent)).toBe(MOOD.cake);
  });

  it('Quince leaves by the entrance and is removed afterwards', () => {
    const s = newGame();
    markFired(s);
    s.flags['fridgeWarmDay'] = 1;
    s.director.queue.push({ atT: 0, eventId: 'pi_cake' });
    run(s, 2);
    expect(s.director.visits).toHaveLength(1);
    run(s, 800);
    expect(s.director.visits).toHaveLength(0);
    expect(Object.values(s.agents).map((a) => a.kind)).toEqual(['player']);
  });
});

describe('seedling grant and rules', () => {
  it('rejects writing the Seedling Grant with no paper', () => {
    const s = newGame();
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'writeGrant' }]))[0]).toMatch(/needs 1 accepted paper/);
  });
});
