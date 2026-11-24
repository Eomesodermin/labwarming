// The pacing test (design doc 12.3). Two scripted bots play the real sim through commands only.
// This is the guard for the "about 30 minutes" promise: run it after every balance change.

import { describe, expect, it } from 'vitest';
import { TICKS_PER_SECOND } from '../../src/content/balance';
import { GOALS } from '../../src/content/facility';
import { createInitialState } from '../../src/sim/createState';
import { todoList } from '../../src/sim/selectors';
import { Bot, AVERAGE_BOT, SLOW_BOT, playBot, type BotOptions, type BotResult } from './bot';

const MIN = TICKS_PER_SECOND * 60;
/** Tick 10,800 is minute 18 and tick 16,800 is minute 28. The slow bot has until tick 24,000 (minute 40). */
const AVERAGE_FROM = 10_800;
const AVERAGE_TO = 16_800;
const SLOW_TO = 24_000;
const SEEDS = [1, 2, 3];

const minutes = (t: number | null): string => (t === null ? 'never' : (t / MIN).toFixed(1));

function line(name: string, seed: number, r: BotResult): string {
  const rows = GOALS.map((g) => `${g.id} ${minutes(r.goalTicks[g.id])}`).join(', ');
  return `${name} bot, seed ${seed}: ${rows}. All five at ${minutes(r.finishedTick)} min.`;
}

function play(opts: BotOptions, seed: number, limit: number, keepGoing = false): { r: BotResult; bot: Bot; state: ReturnType<typeof createInitialState> } {
  const state = createInitialState(seed);
  const { result, bot } = playBot(state, opts, limit, keepGoing);
  return { r: result, bot, state };
}

describe('pacing bots', () => {
  for (const seed of SEEDS) {
    it(`the average bot reaches all five goals between minute 18 and minute 28 (seed ${seed})`, () => {
      const { r } = play(AVERAGE_BOT, seed, 40_000);
      console.log(line('Average', seed, r));
      expect(r.stuck).toBe(false);
      expect(r.finishedTick).not.toBeNull();
      expect(r.finishedTick as number).toBeGreaterThanOrEqual(AVERAGE_FROM);
      expect(r.finishedTick as number).toBeLessThanOrEqual(AVERAGE_TO);
    });

    it(`the slow bot (60 percent efficient) finishes before minute 40 (seed ${seed})`, () => {
      const { r } = play(SLOW_BOT, seed, 40_000);
      console.log(line('Slow', seed, r));
      expect(r.stuck).toBe(false);
      expect(r.finishedTick).not.toBeNull();
      expect(r.finishedTick as number).toBeLessThan(SLOW_TO);
    });
  }

  it('neither bot is ever stuck with nothing to do, and nothing they send is refused', () => {
    for (const opts of [AVERAGE_BOT, SLOW_BOT]) {
      const { r, bot } = play(opts, 5, SLOW_TO, true);
      expect(r.stuck, `stuck at ${r.ticks}: ${JSON.stringify(bot.log.slice(-5))}`).toBe(false);
      expect(r.ticks).toBe(SLOW_TO);
      expect(bot.rejections).toBeLessThanOrEqual(5);
    }
  });

  it('the party plays once while the bots keep playing, and the goal times are recorded', () => {
    const { state } = play(AVERAGE_BOT, 2, SLOW_TO, true);
    expect(state.goals.partyDone).toBe(true);
    expect(state.inbox.filter((m) => m.kind === 'lab_party')).toHaveLength(1);
    for (const g of GOALS) expect(state.goals.reached[g.id]).toBeGreaterThan(0);
    expect(state.goals.prompted.sort()).toEqual(['party', 'thirty']);
  });

  it('a player who follows only the to-do note reaches the first hire inside 12 minutes', () => {
    for (const seed of SEEDS) {
      const state = createInitialState(seed);
      const bot = new Bot(state, { ...AVERAGE_BOT, onlyPlan: ['washup-room', 'autoclave', 'hire-washup'] });
      let hiredAt: number | null = null;
      while (state.tick < 14 * MIN && todoList(state).some((t) => !t.done)) {
        bot.play();
        if (hiredAt === null && state.stats.hires >= 1) hiredAt = state.tick;
      }
      expect(hiredAt, `seed ${seed}`).not.toBeNull();
      expect(hiredAt as number).toBeLessThanOrEqual(12 * MIN);
      expect(todoList(state).filter((t) => !t.done).map((t) => t.id), `seed ${seed}`).toEqual([]);
      console.log(`First hire at minute ${minutes(hiredAt)}, whole note done at minute ${minutes(state.tick)} (seed ${seed}).`);
    }
  });
});
