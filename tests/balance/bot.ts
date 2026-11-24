// A scripted player for the pacing test (design doc 12.3). It plays the real sim through the same
// commands a person sends: walk to a tile, face the station, press E, answer emails, build and hire.
// It never touches state directly. It decides from what a player could see (stock, the inbox, the grid).

import { GOALS, type GoalId } from '../../src/content/facility';
import { hourToTick } from '../../src/content/events';
import { JOBS, type JobId } from '../../src/content/jobs';
import { ORDERS } from '../../src/content/orders';
import { PLOTS } from '../../src/content/map';
import { PAPER, PRESENTATION } from '../../src/content/economy';
import { PLAYER_ID, type Command } from '../../src/sim/commands';
import { ROT_FACING, frontTiles, opposite } from '../../src/sim/grid';
import { findPathToAny } from '../../src/sim/pathfinding';
import { placementBlocker } from '../../src/sim/placement';
import { mulberry32, seedToState } from '../../src/sim/rng';
import type { SimEvent } from '../../src/sim/simEvents';
import { step } from '../../src/sim/step';
import { binFull, coldFree, plotOf, wasteCapacity } from '../../src/sim/stock';
import { startBlocker } from '../../src/sim/systems/jobs';
import { openGrant } from '../../src/sim/systems/grants';
import { paperCost } from '../../src/sim/systems/papers';
import type { Equipment, GameState, Point, Rot } from '../../src/sim/types';

export interface BotOptions {
  /** Ticks the bot takes to look and decide between two tasks. */
  reaction: number;
  /** 1 is a steady player. 0.6 takes 1 / 0.6 as long to do everything it does itself. */
  efficiency: number;
  seed: number;
  /** Only buy these plan steps. Used to check that the to-do note alone is enough to reach the first hire. */
  onlyPlan?: readonly string[];
}

export const AVERAGE_BOT: BotOptions = { reaction: 50, efficiency: 1, seed: 11 };
export const SLOW_BOT: BotOptions = { reaction: 80, efficiency: 0.6, seed: 12 };

type Task =
  | { kind: 'job'; key: string; stationId: string; jobId: JobId }
  | { kind: 'atStation'; key: string; stationId: string; cmd: Command }
  | { kind: 'now'; key: string; cmds: Command[]; delay: number }
  | { kind: 'goto'; key: string; to: Point };

interface PlanStep {
  id: string;
  done: (s: GameState) => boolean;
  /** True when it can be bought now. A step that waits on Reputation lets later steps go first. */
  ready: (s: GameState) => boolean;
  needsRep?: number;
  task: (s: GameState) => Task | null;
}

const PLAYER = PLAYER_ID;

function has(s: GameState, defId: string, plotId?: string): boolean {
  return Object.values(s.equipment).some((e) => e.defId === defId && (plotId === undefined || plotOf(e) === plotId));
}

function staffOf(s: GameState, role: string): number {
  return Object.values(s.agents).filter((a) => a.staff?.role === role).length;
}

/** The first spot in a plot where the piece fits, scanning from the far corner. */
function findSpot(s: GameState, defId: string, plotId: string): { x: number; y: number; rot: Rot } | null {
  const plot = PLOTS.find((p) => p.id === plotId);
  if (!plot) return null;
  for (let y = plot.y; y < plot.y + plot.h; y++) {
    for (let x = plot.x + plot.w - 1; x >= plot.x; x--) {
      for (const rot of [0, 2, 1, 3] as Rot[]) {
        if (placementBlocker(s, defId, x, y, rot) === null) return { x, y, rot };
      }
    }
  }
  return null;
}

function placeTask(s: GameState, defId: string, plotId: string): Task | null {
  const spot = findSpot(s, defId, plotId);
  return spot ? { kind: 'now', key: `place-${defId}`, cmds: [{ type: 'PlaceEquipment', defId, ...spot }], delay: 20 } : null;
}

function hireTask(s: GameState, role: string): Task | null {
  const cand = s.candidates.find((c) => c.role === role);
  return cand ? { kind: 'now', key: `hire-${role}`, cmds: [{ type: 'HireStaff', candidateId: cand.id }], delay: 30 } : null;
}

/** What the bot buys, in order (design doc 2.3 and 5.6). */
const PLAN: PlanStep[] = [
  {
    id: 'washup-room',
    done: (s) => s.plots['b']?.owned === true,
    ready: (s) => s.funds >= 400 + 300 + 120,
    task: () => ({ kind: 'now', key: 'buy-b', cmds: [{ type: 'BuyPlot', plotId: 'b', roomType: 'washup' }], delay: 20 }),
  },
  { id: 'autoclave', done: (s) => has(s, 'autoclave'), ready: (s) => s.plots['b']?.owned === true && s.funds >= 300, task: (s) => placeTask(s, 'autoclave', 'b') },
  { id: 'hire-washup', done: (s) => staffOf(s, 'washup') >= 1, ready: (s) => s.plots['b']?.owned === true && s.funds >= 120, task: (s) => hireTask(s, 'washup') },
  { id: 'hire-tech', done: (s) => staffOf(s, 'technician') >= 1, ready: (s) => s.reputation >= 10 && s.funds >= 200, needsRep: 10, task: (s) => hireTask(s, 'technician') },
  {
    id: 'incubator',
    done: (s) => Object.values(s.equipment).some((e) => e.defId === 'incubator' && e.tier >= 2),
    ready: (s) => s.funds >= 250,
    task: (s) => {
      const inc = Object.values(s.equipment).find((e) => e.defId === 'incubator');
      return inc ? { kind: 'now', key: 'inc-up', cmds: [{ type: 'UpgradeEquipment', equipmentId: inc.id }], delay: 20 } : null;
    },
  },
  {
    id: 'break-room',
    done: (s) => s.plots['c']?.owned === true,
    ready: (s) => s.funds >= 300 + 150,
    task: () => ({ kind: 'now', key: 'buy-c', cmds: [{ type: 'BuyPlot', plotId: 'c', roomType: 'break' }], delay: 20 }),
  },
  { id: 'coffee', done: (s) => has(s, 'coffee'), ready: (s) => s.plots['c']?.owned === true && s.funds >= 150, task: (s) => placeTask(s, 'coffee', 'c') },
  { id: 'hire-cleaner', done: (s) => staffOf(s, 'cleaner') >= 1, ready: (s) => s.funds >= 100, task: (s) => hireTask(s, 'cleaner') },
  {
    id: 'media-room',
    done: (s) => s.plots['d']?.owned === true,
    ready: (s) => s.reputation >= 30 && s.funds >= 800 + 400,
    needsRep: 30,
    task: () => ({ kind: 'now', key: 'buy-d', cmds: [{ type: 'BuyPlot', plotId: 'd', roomType: 'media' }], delay: 20 }),
  },
  { id: 'prep-unit', done: (s) => has(s, 'mediaprep'), ready: (s) => s.plots['d']?.owned === true && s.funds >= 400, task: (s) => placeTask(s, 'mediaprep', 'd') },
];

export interface BotLog {
  tick: number;
  what: string;
}

export class Bot {
  readonly log: BotLog[] = [];
  private rng: number;
  private task: Task | null = null;
  private phase: 'idle' | 'walking' | 'working' | 'wait' = 'idle';
  private waitUntil = 0;
  private startedTick = 0;
  private walkTries = 0;
  private sweetAt = -1;
  private blocked = new Map<string, number>();
  private fails = new Map<string, number>();
  private lastSent: string | null = null;
  private rejectedCount = 0;
  private coaxTries = 0;

  constructor(
    readonly state: GameState,
    readonly opts: BotOptions,
  ) {
    this.rng = seedToState(opts.seed);
  }

  private rand(): number {
    const r = mulberry32(this.rng);
    this.rng = r.state;
    return r.value;
  }

  private note(what: string): void {
    this.log.push({ tick: this.state.tick, what });
  }

  /** Plays one tick: decide, send the commands, step the sim. Returns the sim events. */
  play(): SimEvent[] {
    const cmds = this.act();
    const events = step(this.state, cmds);
    if (this.lastSent && events.some((e) => e.type === 'CommandRejected')) this.onRejected(events);
    this.lastSent = null;
    return events;
  }

  private onRejected(events: SimEvent[]): void {
    const key = this.task?.key ?? this.lastSent;
    if (!key) return;
    this.rejectedCount += 1;
    const n = (this.fails.get(key) ?? 0) + 1;
    this.fails.set(key, n);
    this.blocked.set(key, this.state.tick + 150 * n);
    this.note(`rejected ${key}: ${events.flatMap((e) => (e.type === 'CommandRejected' ? [e.reason] : [])).join('; ')}`);
    this.finish(true);
  }

  get rejections(): number {
    return this.rejectedCount;
  }

  private player(): GameState['agents'][string] {
    return this.state.agents[PLAYER] as GameState['agents'][string];
  }

  // ---- Running a task ----

  private act(): Command[] {
    const s = this.state;
    const p = this.player();
    if (this.phase === 'wait') {
      if (s.tick < this.waitUntil) return [];
      this.phase = 'idle';
    }
    if (this.phase === 'idle') {
      const t = this.decide();
      if (!t) {
        this.waitUntil = s.tick + 10;
        this.phase = 'wait';
        return [];
      }
      this.task = t;
      this.startedTick = s.tick;
      this.walkTries = 0;
      if (t.kind === 'now') {
        this.lastSent = t.key;
        this.finish(false, t.delay);
        return t.cmds;
      }
      this.phase = 'walking';
    }
    const t = this.task as Exclude<Task, { kind: 'now' }>;
    if (this.phase === 'walking') {
      if (t.kind === 'goto') {
        if (p.x === t.to.x && p.y === t.to.y) {
          this.finish(false);
          return [];
        }
        if (p.path.length === 0) return this.walk(t.to);
        return [];
      }
      const eq = s.equipment[t.stationId];
      if (!eq) {
        this.finish(true);
        return [];
      }
      if (p.path.length > 0) return [];
      const fronts = frontTiles(eq);
      const onFront = fronts.some((f) => f.x === p.x && f.y === p.y);
      if (!onFront) {
        const route = findPathToAny(s, { x: p.x, y: p.y }, fronts);
        if (!route || route.length === 0) {
          this.blocked.set(t.key, s.tick + 200);
          this.finish(true);
          return [];
        }
        return this.walk(route[route.length - 1] as Point);
      }
      const want = opposite(ROT_FACING[eq.rot]);
      if (p.facing !== want) return [{ type: 'MovePlayer', dir: want }];
      // At the station, facing it.
      if (t.kind === 'atStation') {
        this.lastSent = t.key;
        this.finish(false, 10);
        return [t.cmd];
      }
      const def = JOBS[t.jobId];
      if (startBlocker(s, def, eq, PLAYER) !== null) {
        this.blocked.set(t.key, s.tick + 60);
        this.finish(true);
        return [];
      }
      this.lastSent = t.key;
      this.phase = 'working';
      this.sweetAt = -1;
      return [{ type: 'Interact', jobId: t.jobId }];
    }
    if (this.phase === 'working') {
      const job = p.jobId ? s.jobs[p.jobId] : undefined;
      if (!job) {
        this.finish(false);
        return [];
      }
      if (this.sweetAt < 0) this.sweetAt = Math.round(job.totalTicks * (0.25 + 0.65 * this.rand()));
      if (!job.sweetPressed && job.progressTicks >= this.sweetAt) return [{ type: 'SweetSpotPress' }];
    }
    return [];
  }

  private walk(to: Point): Command[] {
    this.walkTries += 1;
    if (this.walkTries > 4) {
      this.blocked.set(this.task?.key ?? 'walk', this.state.tick + 300);
      this.finish(true);
      return [];
    }
    this.lastSent = this.task?.key ?? null;
    return [{ type: 'SetPlayerTarget', x: to.x, y: to.y }];
  }

  /** The task is over. A player who is 60 percent as efficient spends the other 40 percent loitering. */
  private finish(failed: boolean, extra = 0): void {
    const s = this.state;
    const spent = s.tick - this.startedTick;
    const slack = failed ? 0 : Math.round(spent * (1 / this.opts.efficiency - 1));
    const react = Math.round(this.opts.reaction / (this.opts.efficiency === 1 ? 1 : 1)) + Math.round(extra / this.opts.efficiency);
    this.waitUntil = s.tick + react + slack;
    this.phase = 'wait';
    this.task = null;
  }

  // ---- Choosing what to do ----

  private ok(key: string): boolean {
    return (this.blocked.get(key) ?? 0) <= this.state.tick;
  }

  private nearest(defId: string, can: (e: Equipment) => boolean): Equipment | null {
    const s = this.state;
    const p = this.player();
    let best: Equipment | null = null;
    let bestLen = Infinity;
    for (const eq of Object.values(s.equipment)) {
      if (eq.defId !== defId || !can(eq)) continue;
      const r = findPathToAny(s, { x: p.x, y: p.y }, frontTiles(eq));
      if (!r) continue;
      if (r.length < bestLen) {
        best = eq;
        bestLen = r.length;
      }
    }
    return best;
  }

  private job(jobId: JobId, extra: (e: Equipment) => boolean = () => true): Task | null {
    const s = this.state;
    const def = JOBS[jobId];
    const eq = this.nearest(def.station, (e) => startBlocker(s, def, e, PLAYER) === null && extra(e) && this.ok(`${jobId}@${e.id}`));
    return eq ? { kind: 'job', key: `${jobId}@${eq.id}`, stationId: eq.id, jobId } : null;
  }

  private atDesk(key: string, cmd: Command): Task | null {
    const desk = this.nearest('desk', () => true);
    if (!desk || !this.ok(key)) return null;
    return { kind: 'atStation', key, stationId: desk.id, cmd };
  }

  private decide(): Task | null {
    const s = this.state;
    const p = this.player();

    // Emails that ask a question: say no to extra panels, yes to anything else.
    for (const m of s.inbox) {
      if (m.choices && m.chosen === undefined && this.ok(`mail-${m.id}`)) {
        const pick = m.kind === 'pi_one_more_panel' ? m.choices.length - 1 : 0;
        return { kind: 'now', key: `mail-${m.id}`, cmds: [{ type: 'ChooseEventOption', emailId: m.id, option: pick }], delay: 20 };
      }
    }

    // A lost box with a question mark: walk over it.
    const lost = s.lostBoxes[0];
    if (lost && this.ok('lost')) return { kind: 'goto', key: 'lost', to: { x: lost.x, y: lost.y } };

    // A broken autoclave: pat it twice, then call the engineer from the desk.
    const broken = Object.values(s.equipment).find((e) => e.defId === 'autoclave' && e.broken);
    if (broken && !(broken.repairTicks && broken.repairTicks > 0) && this.ok('autoclave-fix')) {
      this.coaxTries += 1;
      if (this.coaxTries > 2) {
        const t = this.atDesk('autoclave-fix', { type: 'CallEngineer' });
        if (t) {
          this.coaxTries = 0;
          return t;
        }
      } else return { kind: 'atStation', key: 'autoclave-fix', stationId: broken.id, cmd: { type: 'CoaxAutoclave', equipmentId: broken.id } };
    }

    // The fridge: repair it when the box cannot be put away, media cannot be made, or it has gone warm.
    const fridge = Object.values(s.equipment).find((e) => e.defId === 'fridge' && e.broken);
    if (fridge && s.funds >= 150 && this.ok('fridge')) {
      const stuckBox = s.boxes.length > 0 && coldFree(s) < 2 && s.boxes.some((b) => ORDERS[b.orderId as keyof typeof ORDERS]?.item === 'assayKits');
      const noMedia = s.stock.media <= 1 && s.stock.mediaPowder > 0 && coldFree(s) < 3;
      const warm = s.inbox.some((m) => m.kind === 'fail_fridge_warm');
      if (stuckBox || noMedia || warm) return { kind: 'atStation', key: 'fridge', stationId: fridge.id, cmd: { type: 'RepairEquipment', equipmentId: fridge.id } };
    }

    // Purchases from the plan. A step that waits on Reputation lets the next one go first.
    for (const stepDef of PLAN) {
      if (this.opts.onlyPlan && !this.opts.onlyPlan.includes(stepDef.id)) continue;
      if (stepDef.done(s)) continue;
      if (stepDef.ready(s)) {
        const t = stepDef.task(s);
        if (t && this.ok(t.key)) return t;
      }
      if (stepDef.needsRep !== undefined && s.reputation < stepDef.needsRep) continue;
      break;
    }

    // Desk work.
    const open = s.inspection && s.inspection.phase === 'announced' && !s.inspection.signed ? this.job('signLogbook') : null;
    if (open) return open;
    if (s.papers.some((x) => x.status === 'revise') && s.data >= PAPER.reviseData) {
      const t = this.job('revisePaper');
      if (t) return t;
    }
    if (openGrant(s)) {
      const t = this.job('writeGrant');
      if (t) return t;
    }
    const inReview = s.papers.filter((x) => x.status === 'review').length;
    if (s.data >= paperCost(s) && inReview < 2 && s.stats.papersWritten < 6) {
      const t = this.job('writePaper');
      if (t) return t;
    }
    if (s.stats.presentations < 1 && s.stats.papersWritten >= 2 && s.data >= PRESENTATION.data) {
      const t = this.job('makePresentation');
      if (t) return t;
    }

    // Orders when stock runs low and nothing is on the way.
    const coming = (id: string): boolean => s.orders.some((o) => o.orderId === id) || s.boxes.some((b) => b.orderId === id) || s.lostBoxes.some((b) => b.orderId === id);
    if (s.stock.assayKits <= 1 && !coming('assayKitBox') && s.funds >= ORDERS.assayKitBox.price) {
      const t = this.atDesk('order-kits', { type: 'PlaceOrder', orderId: 'assayKitBox' });
      if (t) return t;
    }
    const powderNeeded = s.stock.mediaPowder === 0 && s.facility.batchLeft === 0 && !(s.facility.autoReorder && has(s, 'mediaprep'));
    if (powderNeeded && !coming('mediaPowderBox') && s.funds >= ORDERS.mediaPowderBox.price) {
      const t = this.atDesk('order-powder', { type: 'PlaceOrder', orderId: 'mediaPowderBox' });
      if (t) return t;
    }
    if (s.stock.cleanFlasks <= 1 && s.stock.dirtyFlasks === 0 && !coming('flaskBox') && s.funds >= ORDERS.flaskBox.price) {
      const t = this.atDesk('order-flasks', { type: 'PlaceOrder', orderId: 'flaskBox' });
      if (t) return t;
    }

    // The lab loop.
    const bin = this.job('binCulture');
    if (bin) return bin;
    const wasteNeeded = this.job('takeOutWaste', (e) => {
      const id = plotOf(e);
      return id !== null && (binFull(s, id) || (s.plots[id]?.waste ?? 0) >= wasteCapacity(s, id) * 0.75);
    });
    if (wasteNeeded) return wasteNeeded;
    const exp = this.job('runExperiment');
    if (exp) return exp;
    if (s.boxes.length > 0) {
      const t = this.job('putAwayOrder');
      if (t) return t;
    }
    const split = this.job('splitCells');
    if (split) return split;
    const wash = this.job('washFlask', () => s.stock.dirtyFlasks >= 2 || s.stock.cleanFlasks <= 3);
    if (wash) return wash;
    if (s.stock.media < 4) {
      const t = this.job('makeMedia');
      if (t) return t;
    }
    const tidy = this.job('tidyUp', (e) => (s.plots[plotOf(e) ?? '']?.cleanliness ?? 100) < 60);
    if (tidy) return tidy;
    const last = this.job('washFlask');
    if (last) return last;
    void p;
    void hourToTick;
    return null;
  }
}

/** Everything the pacing test and the report need to know about how the bot got on. */
export interface BotResult {
  goalTicks: Record<GoalId, number | null>;
  finishedTick: number | null;
  stuck: boolean;
  ticks: number;
  rejections: number;
  funds: number;
  reputation: number;
  rooms: number;
}

/**
 * Plays until all goals are reached, the tick limit is hit or the bot is stuck. With `keepGoing`
 * it carries on to the tick limit after the goals, which checks it never runs out of things to do.
 */
export function playBot(state: GameState, opts: BotOptions, limit: number, keepGoing = false): { result: BotResult; bot: Bot } {
  const bot = new Bot(state, opts);
  let lastSig = '';
  let lastChange = 0;
  let stuck = false;
  while (state.tick < limit) {
    bot.play();
    if (state.tick % 300 === 0) {
      const sig = JSON.stringify([state.funds, state.data, state.reputation, state.stats, Object.keys(state.goals.reached).length]);
      if (sig !== lastSig) {
        lastSig = sig;
        lastChange = state.tick;
      } else if (state.tick - lastChange >= 4800) {
        stuck = true;
        break;
      }
    }
    if (!keepGoing && GOALS.every((g) => state.goals.reached[g.id] !== undefined)) break;
  }
  const goalTicks = {} as Record<GoalId, number | null>;
  for (const g of GOALS) goalTicks[g.id] = state.goals.reached[g.id] ?? null;
  const all = GOALS.every((g) => goalTicks[g.id] !== null);
  return {
    bot,
    result: {
      goalTicks,
      finishedTick: all ? Math.max(...GOALS.map((g) => goalTicks[g.id] as number)) : null,
      stuck,
      ticks: state.tick,
      rejections: bot.rejections,
      funds: state.funds,
      reputation: state.reputation,
      rooms: Object.values(state.plots).filter((x) => x.owned).length,
    },
  };
}
