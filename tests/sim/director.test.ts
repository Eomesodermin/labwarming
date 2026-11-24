import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../../src/content/balance';
import { DIRECTOR, EVENTS, EVENT_IDS, REQUESTS, SCRIPTED_BEATS } from '../../src/content/events';
import { createInitialState } from '../../src/sim/createState';
import { step } from '../../src/sim/step';
import { directorSystem, failuresAllowed } from '../../src/sim/systems/director';
import { fireEvent } from '../../src/sim/systems/eventCore';
import { timelineTick } from '../../src/sim/ticks';
import type { GameState } from '../../src/sim/types';
import { markFired, mails, newGame, rejections, run, setClock } from './helpers';

const noEvents = (): never[] => [];

/** One tick of the clock, with the day rolling over, so timeline time keeps moving forward. */
function tickClock(s: GameState): void {
  s.tick += 1;
  s.clock.tickOfDay += 1;
  if (s.clock.tickOfDay >= TICKS_PER_DAY) {
    s.clock.tickOfDay = 0;
    s.clock.day += 1;
  }
}

/** Runs the director alone for some ticks, so other systems do not get in the way. */
function direct(s: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    tickClock(s);
    directorSystem(s, noEvents());
  }
}

describe('scripted beats', () => {
  it('starts with the welcome email, already marked as fired', () => {
    const s = newGame();
    expect(mails(s, 'pi_welcome')).toHaveLength(1);
    expect(s.director.firedBeats).toContain('pi_welcome');
    expect(mails(s, 'pi_welcome')[0]?.body).toMatch(/Best, W\nSent from my phone$/);
  });

  it('fires the Day 2, 09:00 email with a request, once', () => {
    const s = newGame();
    setClock(s, 2, 9, 6);
    run(s, 12);
    const mail = mails(s, 'pi_quick_one');
    expect(mail).toHaveLength(1);
    expect(mail[0]?.body).toContain('three little experiments');
    expect(mail[0]?.body).toContain('Request: Run 3 experiments by Day 3');
    expect(s.director.requests.map((r) => r.id)).toEqual(['pi_quick_one']);
    run(s, 300);
    expect(mails(s, 'pi_quick_one')).toHaveLength(1);
  });

  it('does not fire a beat before its time', () => {
    const s = newGame();
    setClock(s, 2, 9, 40);
    run(s, 20);
    expect(mails(s, 'pi_quick_one')).toHaveLength(0);
  });

  it('announces the grants on Day 3 and Day 6 at 09:00', () => {
    const s = newGame();
    markFired(s, ['grant_announce_equipment', 'grant_announce_foundation']);
    setClock(s, 3, 9, 6);
    run(s, 12);
    expect(s.grantCalls['equipment']).toMatchObject({ announced: true, deadlineDay: 5 });
    expect(mails(s, 'grant_announce')[0]?.body).toContain('You have until Day 5. Plenty of time!');
    expect(s.grantCalls['foundation']?.announced).toBe(false);
    setClock(s, 6, 9, 6);
    run(s, 12);
    expect(s.grantCalls['foundation']).toMatchObject({ announced: true, deadlineDay: 10 });
  });

  it('holds back a request beat while another request is active, then fires it', () => {
    const s = newGame();
    markFired(s, ['pi_slides_tonight']);
    s.director.requests.push({ id: 'pi_quick_one', dueT: 1e9, needs: [{ stat: 'experiments', target: 99, base: 0 }] });
    setClock(s, 6, 14, 6);
    run(s, 12);
    expect(mails(s, 'pi_slides_tonight')).toHaveLength(0);
    s.director.requests = [];
    run(s, 12);
    expect(mails(s, 'pi_slides_tonight')).toHaveLength(1);
    expect(s.director.requests[0]?.id).toBe('pi_slides_tonight');
  });

  it('fires the admin beats on Day 7', () => {
    const s = newGame();
    markFired(s, ['admin_waste_rules', 'admin_fire_test']);
    setClock(s, 7, 9, 6);
    run(s, 12);
    expect(mails(s, 'admin_waste_rules')).toHaveLength(1);
    setClock(s, 7, 14, 6);
    run(s, 12);
    expect(mails(s, 'admin_fire_test')).toHaveLength(1);
  });

  it('only names events that exist', () => {
    for (const b of SCRIPTED_BEATS) expect(EVENTS[b.event], b.key).toBeDefined();
  });
});

describe('the random pool', () => {
  function openPool(s: GameState): void {
    s.director.firedBeats.push('pi_quick_one');
    s.tick = 100_000;
    s.director.lastRandomT = -1e6;
    s.director.lastFailureT = -1e6;
  }

  it('stays closed until the first scripted request has fired', () => {
    const s = newGame();
    s.tick = 100_000;
    s.director.lastRandomT = -1e6;
    direct(s, 2300);
    expect(s.inbox.map((m) => m.kind).sort()).toEqual(['fail_fridge_warm', 'pi_welcome']);
  });

  it('fires at most one random event every 90 s', () => {
    const s = newGame(3);
    openPool(s);
    s.reputation = 30;
    s.data = 40;
    const times: number[] = [];
    const kinds: string[] = [];
    let seen = s.inbox.length;
    for (let i = 0; i < 12000; i++) {
      tickClock(s);
      s.director.requests = [];
      directorSystem(s, noEvents());
      if (s.inbox.length > seen) {
        const fresh = s.inbox.slice(seen).map((m) => m.kind);
        kinds.push(...fresh);
        if (fresh.some((k) => EVENTS[k]?.pool)) times.push(i);
        seen = s.inbox.length;
      }
    }
    expect(times.length).toBeGreaterThan(3);
    for (let i = 1; i < times.length; i++) expect((times[i] as number) - (times[i - 1] as number), kinds.join()).toBeGreaterThanOrEqual(DIRECTOR.randomGapSec * 10);
  });

  it('never fires a failure in the first 6 minutes, and keeps failures 120 s apart', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = newGame(seed);
      s.director.firedBeats.push('pi_quick_one');
      s.director.lastRandomT = -1e6;
      s.reputation = 99;
      s.data = 99;
      expect(failuresAllowed(s)).toBe(false);
      const failureAt: number[] = [];
      const fail = new Set(EVENT_IDS.filter((id) => EVENTS[id]?.failure));
      let seen = s.inbox.length;
      for (let i = 0; i < 9000; i++) {
        tickClock(s);
        directorSystem(s, noEvents());
        for (const m of s.inbox.slice(seen)) if (fail.has(m.kind)) failureAt.push(s.tick);
        seen = s.inbox.length;
      }
      for (const t of failureAt) expect(t).toBeGreaterThanOrEqual(3600);
      for (let i = 1; i < failureAt.length; i++) expect((failureAt[i] as number) - (failureAt[i - 1] as number)).toBeGreaterThanOrEqual(1200);
    }
  });

  it('picks by weight: heavier events come up more often', () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 400; seed++) {
      const s = newGame(seed);
      openPool(s);
      s.reputation = 30;
      s.data = 40;
      s.papers.push({ id: 'p', number: 1, status: 'accepted', reviewTicksLeft: 0 });
      s.director.firedBeats.push('admin_waste_rules', 'pi_slides_tonight');
      s.flags['fridgeWarmDay'] = 1;
      s.clock.tickOfDay = 1500;
      for (let i = 0; i < 4000 && s.inbox.length === 1; i++) {
        tickClock(s);
        directorSystem(s, noEvents());
      }
      const kind = s.inbox[1]?.kind;
      if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
    }
    expect(counts['pi_quick_one']).toBeGreaterThan(counts['admin_waste_rules'] ?? 0);
    expect(Object.keys(counts).length).toBeGreaterThan(4);
  });

  it('respects cooldowns: the same event does not come back inside its cooldown', () => {
    const s = newGame(2);
    s.director.firedBeats.push('pi_quick_one');
    s.reputation = 30;
    s.tick = 100_000;
    fireEvent(s, 'pi_what_project', []);
    const def = EVENTS['pi_what_project'];
    s.director.cooldowns['pi_what_project'] = timelineTick(s) + (def?.pool?.cooldownDays ?? 0) * TICKS_PER_DAY;
    s.director.lastRandomT = -1e6;
    for (let i = 0; i < 1500; i++) {
      tickClock(s);
      directorSystem(s, noEvents());
    }
    expect(mails(s, 'pi_what_project').length).toBe(1);
  });

  it('only lets one PI request be active at a time', () => {
    const s = newGame();
    fireEvent(s, 'pi_quick_one', []);
    expect(s.director.requests).toHaveLength(1);
    s.reputation = 99;
    s.papers.push({ id: 'p', number: 1, status: 'accepted', reviewTicksLeft: 0 });
    openPoolEvents(s);
    expect(s.director.requests).toHaveLength(1);
  });

  function openPoolEvents(s: GameState): void {
    s.director.firedBeats.push('pi_quick_one');
    s.director.lastRandomT = -1e6;
    s.tick = 100_000;
    for (let i = 0; i < 20000; i++) {
      tickClock(s);
      directorSystem(s, noEvents());
    }
  }
});

describe('determinism', () => {
  it('gives the same inbox for the same seed and a different one for another seed', () => {
    const play = (seed: number): string => {
      const s = createInitialState(seed);
      for (let t = 0; t < 7000; t++) step(s, []);
      return JSON.stringify([s.inbox.map((m) => [m.kind, m.day, m.tickOfDay]), s.director]);
    };
    expect(play(11)).toBe(play(11));
    expect(play(11)).not.toBe(play(12));
  });

  it('keeps the director on its own random stream: the main stream is untouched by events', () => {
    const a = newGame(9);
    const b = newGame(9);
    fireEvent(b, 'fail_mystery_tube', []);
    for (let i = 0; i < 50; i++) b.director.rngState = (b.director.rngState + 1) >>> 0;
    expect(a.rngState).toBe(b.rngState);
  });
});

describe('commands', () => {
  it('rejects an answer for an email without choices, and a second answer', () => {
    const s = newGame();
    expect(rejections(step(s, [{ type: 'ChooseEventOption', emailId: s.inbox[0]?.id ?? '', option: 0 }]))).toEqual(['There is nothing to answer in that email']);
    const mail = fireEvent(s, 'pi_what_project', []);
    expect(rejections(step(s, [{ type: 'ChooseEventOption', emailId: mail?.id ?? '', option: 5 }]))).toEqual(['That is not one of the answers']);
    step(s, [{ type: 'ChooseEventOption', emailId: mail?.id ?? '', option: 1 }]);
    expect(rejections(step(s, [{ type: 'ChooseEventOption', emailId: mail?.id ?? '', option: 0 }]))).toEqual(['You already answered that one']);
  });

  it('every request in the content has the events and numbers it needs', () => {
    for (const r of Object.values(REQUESTS)) {
      expect(EVENTS[r.id]?.request, r.id).toBe(r.id);
      expect(r.reward.reputation).toBeGreaterThan(0);
      expect(Number.isInteger(r.missFunds)).toBe(true);
    }
  });
});
