import { describe, expect, it } from 'vitest';
import { PAPER } from '../../src/content/economy';
import { MOOD } from '../../src/content/staff';
import { PLAYER_ID } from '../../src/sim/commands';
import { step } from '../../src/sim/step';
import { fireEvent } from '../../src/sim/systems/eventCore';
import { computeMood, hireStaff } from '../../src/sim/systems/staff';
import { doJob, markFired, mails, newGame, rejections, run, setClock, stand } from './helpers';

describe('PI requests', () => {
  it('starts a request with a deadline 1.5 days away, and sets piRequest', () => {
    const s = newGame();
    expect(s.flags['piRequest']).toBeUndefined();
    fireEvent(s, 'pi_quick_one', []);
    run(s, 2);
    expect(s.flags['piRequest']).toBe(true);
    expect(s.director.requests[0]?.dueT).toBeGreaterThan(3500);
  });

  it('three experiments complete "a quick one": +200 Funds, +5 Reputation, and piRequest clears', () => {
    const s = newGame();
    markFired(s);
    fireEvent(s, 'pi_quick_one', []);
    run(s, 2);
    s.stats.experiments += 2;
    run(s, 10);
    expect(s.director.requests).toHaveLength(1);
    s.stats.experiments += 1;
    run(s, 10);
    expect(s.director.requests).toHaveLength(0);
    expect(s.funds).toBe(700);
    expect(s.reputation).toBe(5);
    expect(s.flags['piRequest']).toBe(false);
    expect(s.stats.requestsDone).toBe(1);
    expect(s.director.resolved['pi_quick_one']).toBe('done');
    expect(mails(s, 'pi_quick_one_done')).toHaveLength(1);
  });

  it('counts only experiments done after the request began', () => {
    const s = newGame();
    s.stats.experiments = 2;
    fireEvent(s, 'pi_quick_one', []);
    run(s, 10);
    expect(s.director.requests).toHaveLength(1);
  });

  it('a missed request gives the friendly email and +50, and clears piRequest', () => {
    const s = newGame();
    markFired(s);
    fireEvent(s, 'pi_quick_one', []);
    run(s, 2);
    setClock(s, 3, 15);
    run(s, 10);
    expect(s.director.requests).toHaveLength(0);
    expect(s.funds).toBe(550);
    expect(s.reputation).toBe(0);
    expect(s.flags['piRequest']).toBe(false);
    expect(mails(s, 'pi_quick_one_missed')[0]?.body).toContain('No worries, we will call it preliminary.');
    expect(s.stats.requestsMissed).toBe(1);
    expect(s.director.resolved['pi_quick_one']).toBe('missed');
  });

  it('"a new direction" needs 2 splits and 2 experiments and pays 30 Data', () => {
    const s = newGame();
    markFired(s);
    fireEvent(s, 'pi_new_direction', []);
    run(s, 2);
    s.stats.splits += 2;
    run(s, 6);
    expect(s.director.requests).toHaveLength(1);
    s.stats.experiments += 2;
    run(s, 6);
    expect(s.data).toBe(30);
    expect(s.reputation).toBe(5);
  });

  it('"slides tonight" is due at 18:00 the next day and a presentation completes it', () => {
    const s = newGame();
    markFired(s);
    setClock(s, 6, 14);
    fireEvent(s, 'pi_slides_tonight', []);
    expect(mails(s, 'pi_slides_tonight')[0]?.body).toContain('by Day 7, 18:00');
    s.data = 20;
    doJob(s, 'desk', 'makePresentation');
    run(s, 10);
    expect(s.funds).toBe(500 + 150);
    expect(s.reputation).toBe(8 + 5);
    const s2 = newGame();
    markFired(s2);
    setClock(s2, 6, 14);
    fireEvent(s2, 'pi_slides_tonight', []);
    run(s2, 10);
    setClock(s2, 7, 17);
    run(s2, 10);
    expect(s2.director.requests).toHaveLength(1);
    s2.clock.day = 8;
    s2.clock.tickOfDay = 0;
    run(s2, 10);
    expect(s2.director.requests).toHaveLength(0);
    expect(s2.funds).toBe(550);
    expect(mails(s2, 'pi_slides_tonight_missed')[0]?.body).toContain('I will draw it on the whiteboard.');
  });

  it('takes 5 off staff Mood while active', () => {
    const s = newGame();
    s.funds = 5000;
    s.reputation = 10;
    const cand = s.candidates.find((c) => c.role === 'technician');
    const ev: Parameters<typeof hireStaff>[2] = [];
    hireStaff(s, cand?.id ?? '', ev);
    const agent = Object.values(s.agents).find((a) => a.staff);
    if (!agent) throw new Error('no staff');
    if (agent.staff) agent.staff.trait = 'tidy';
    const before = computeMood(s, agent);
    fireEvent(s, 'pi_quick_one', []);
    expect(computeMood(s, agent)).toBe(before + MOOD.piRequest);
    s.director.requests = [];
    s.flags['piRequest'] = false;
    expect(computeMood(s, agent)).toBe(before);
  });
});

describe('answering emails', () => {
  it('"one more panel": yes makes the next paper cost 60 Data and pay +15 Reputation; the reply arrives', () => {
    const s = newGame();
    const mail = fireEvent(s, 'pi_one_more_panel', []);
    step(s, [{ type: 'ChooseEventOption', emailId: mail?.id ?? '', option: 0 }]);
    expect(s.inbox.find((m) => m.id === mail?.id)?.chosen).toBe(0);
    expect(s.flags['onePanel']).toBe(true);
    expect(mails(s, 'pi_one_more_panel_reply')[0]?.body).toContain('I knew you would');
    s.data = 59;
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'writePaper' }]))).toEqual(['Needs 60 Data']);
    s.data = 65;
    doJob(s, 'desk', 'writePaper');
    expect(s.data).toBe(5);
    expect(s.papers[0]?.panel).toBe(true);
    expect(s.flags['onePanel']).toBe(false);
    run(s, 420);
    expect(s.reputation).toBe(PAPER.panelReputation);
  });

  it('"one more panel": no does nothing but earns "Brave!"', () => {
    const s = newGame();
    const mail = fireEvent(s, 'pi_one_more_panel', []);
    step(s, [{ type: 'ChooseEventOption', emailId: mail?.id ?? '', option: 1 }]);
    expect(s.flags['onePanel']).toBeUndefined();
    expect(mails(s, 'pi_one_more_panel_reply')[0]?.body).toContain('Brave!');
  });

  it('"which project" gives +1 Reputation either way', () => {
    for (const option of [0, 1]) {
      const s = newGame();
      const mail = fireEvent(s, 'pi_what_project', []);
      step(s, [{ type: 'ChooseEventOption', emailId: mail?.id ?? '', option }]);
      expect(s.reputation).toBe(1);
    }
  });

  it('the mystery tube: bin adds waste, keep may give +5 Data', () => {
    const bin = newGame();
    const m1 = fireEvent(bin, 'fail_mystery_tube', []);
    step(bin, [{ type: 'ChooseEventOption', emailId: m1?.id ?? '', option: 1 }]);
    expect(bin.plots['a']?.waste).toBe(1);
    let gained = 0;
    let nothing = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(seed);
      const m = fireEvent(s, 'fail_mystery_tube', []);
      step(s, [{ type: 'ChooseEventOption', emailId: m?.id ?? '', option: 0 }]);
      if (s.data === 5) gained += 1;
      else if (s.data === 0) nothing += 1;
    }
    expect(gained).toBeGreaterThan(5);
    expect(nothing).toBeGreaterThan(5);
    expect(gained + nothing).toBe(40);
  });
});

describe('the player agent is untouched by visitors', () => {
  it('keeps the player alone in the agent list until someone visits', () => {
    const s = newGame();
    expect(Object.keys(s.agents)).toEqual([PLAYER_ID]);
  });
});
