import { TICKS_PER_DAY } from '../../content/balance';
import { GRANTS, grantDef } from '../../content/economy';
import {
  EVENTS,
  INSPECTION,
  REQUESTS,
  withSignoff,
  type Condition,
  type Effect,
  type EventDef,
} from '../../content/events';
import { ENERGY } from '../../content/staff';
import { sendEmail } from '../email';
import { mulberry32, seedToState } from '../rng';
import type { SimEvent } from '../simEvents';
import { describeTimeline, secondsToTicks, timelineAt, timelineTick } from '../ticks';
import { addStock } from '../stock';
import type { Culture, Director, Email, GameState, GrantCall } from '../types';
import { spawnVisit, staffToDrillSpots } from './visits';

/** A fresh director. It has its own random stream so the other sequences stay the same. */
export function newDirector(seed: number): Director {
  return {
    rngState: seedToState((seed ^ 0x2f6e2b1) >>> 0),
    firedBeats: [],
    cooldowns: {},
    requests: [],
    resolved: {},
    queue: [],
    lastRandomT: 0,
    lastFailureT: -1_000_000,
    visits: [],
    cake: null,
    drill: null,
    engineerCalls: 0,
    binsFull: [],
  };
}

export function newGrantCalls(): Record<string, GrantCall> {
  const out: Record<string, GrantCall> = {};
  for (const g of GRANTS) out[g.id] = { announced: g.deadlineDay === null, deadlineDay: null, payPercent: 100, crashes: 0 };
  return out;
}

// ---- The director's random stream ----

export function dFloat(state: GameState): number {
  const r = mulberry32(state.director.rngState);
  state.director.rngState = r.state;
  return r.value;
}

export function dInt(state: GameState, n: number): number {
  return Math.floor(dFloat(state) * n);
}

export function dChance(state: GameState, p: number): boolean {
  return dFloat(state) < p;
}

// ---- Conditions ----

function acceptedPapers(state: GameState): number {
  return state.papers.filter((p) => p.status === 'accepted').length;
}

export function staffCount(state: GameState): number {
  return Object.values(state.agents).filter((a) => a.staff !== null).length;
}

export function checkCondition(state: GameState, c: Condition): boolean {
  switch (c.type) {
    case 'noRequest':
      return state.director.requests.length === 0;
    case 'minReputation':
      return state.reputation >= c.n;
    case 'minPapers':
      return acceptedPapers(state) >= c.n;
    case 'minData':
      return state.data >= c.n;
    case 'noPaperInReview':
      return !state.papers.some((p) => p.status === 'review');
    case 'noFlag':
      return state.flags[c.key] !== true;
    case 'minGrowing':
      return state.cultures.filter((x) => x.status === 'growing').length >= c.n;
    case 'hasEquipment':
      return Object.values(state.equipment).some((e) => e.defId === c.defId);
    case 'minStaff':
      return staffCount(state) >= c.n;
    case 'afterTick':
      return state.clock.tickOfDay >= c.tickOfDay;
    case 'beatFired':
      return state.director.firedBeats.includes(c.id);
    case 'noContamination':
      return state.stats.contaminations === 0;
    case 'hasCulture':
      return state.cultures.some((x) => x.status !== 'contaminated');
    case 'noInspection':
      return state.inspection === null || state.inspection.phase === 'done';
  }
}

export function canFire(state: GameState, def: EventDef): boolean {
  return (def.needs ?? []).every((c) => checkCondition(state, c));
}

// ---- Text ----

function tokensFor(state: GameState, params: Record<string, string> | undefined): Record<string, string> {
  const t: Record<string, string> = {};
  const gid = params?.['grantId'];
  const def = gid ? grantDef(gid) : undefined;
  if (def) {
    const call = state.grantCalls[def.id];
    const deadline = call?.deadlineDay ?? def.deadlineDay;
    t['grant'] = def.name;
    t['funder'] = def.funder;
    t['need'] = def.needText;
    t['pays'] = String(Math.round((def.pays * (call?.payPercent ?? 100)) / 100));
    t['rep'] = String(def.reputation);
    t['percent'] = String(call?.payPercent ?? 100);
    t['day'] = String(deadline ?? '');
    t['deadline'] = deadline === null ? '' : `You have until Day ${deadline}. `;
  }
  return { ...t, ...params };
}

function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => tokens[k] ?? m);
}

function rewardText(r: { funds?: number; data?: number; reputation: number }): string {
  const parts: string[] = [];
  if (r.funds) parts.push(`+${r.funds} Funds`);
  if (r.data) parts.push(`+${r.data} Data`);
  parts.push(`+${r.reputation} Reputation`);
  return parts.join(', ');
}

// ---- Requests ----

export function startRequest(state: GameState, requestId: string): void {
  const def = REQUESTS[requestId];
  if (!def) return;
  const T = timelineTick(state);
  const dueT = def.nextDayEnd ? timelineAt(state.clock.day + 1, TICKS_PER_DAY) : T + Math.round((def.withinDays ?? 1) * TICKS_PER_DAY);
  const stat = (s: string): number => (s === 'presentations' ? state.stats.presentations : s === 'splits' ? state.stats.splits : state.stats.experiments);
  state.director.requests.push({
    id: requestId,
    dueT,
    needs: def.needs.map((n) => ({ stat: n.stat, target: n.n, base: stat(n.stat) })),
  });
  state.flags['piRequest'] = true;
}

// ---- Firing an event ----

export interface FireOptions {
  params?: Record<string, string>;
  /** The effect already happened (a real contamination, say): send only the email. */
  skipEffects?: boolean;
}

/** Sends the event's email and runs its effects. Returns the email, or null for silent events. */
export function fireEvent(state: GameState, id: string, events: SimEvent[], opts: FireOptions = {}): Email | null {
  const def = EVENTS[id];
  if (!def) return null;
  const T = timelineTick(state);
  if (def.group === 'failure') state.director.lastFailureT = T;
  const tokens = tokensFor(state, opts.params);
  let mail: Email | null = null;
  if (!def.silent) {
    let body = fill(def.body, tokens);
    const req = def.request ? REQUESTS[def.request] : undefined;
    if (req && !opts.skipEffects) {
      const dueT = req.nextDayEnd ? timelineAt(state.clock.day + 1, TICKS_PER_DAY) : T + Math.round((req.withinDays ?? 1) * TICKS_PER_DAY);
      body += `\n\nRequest: ${req.label} by ${describeTimeline(dueT)}.\nDone: ${rewardText(req.reward)}. Missed: +${req.missFunds} Funds and a shrug.`;
    }
    mail = sendEmail(
      state,
      { kind: id, from: fill(def.from, tokens), subject: fill(def.subject, tokens), body: withSignoff(def, body), choices: def.choices?.map((c) => c.label) },
      events,
    );
  }
  if (!opts.skipEffects) {
    for (const e of def.effects ?? []) applyEffect(state, e, events, opts.params);
    if (def.request) startRequest(state, def.request);
  }
  return mail;
}

/** The player picks an answer in an email. */
export function chooseOption(state: GameState, emailId: string, option: number, events: SimEvent[]): void {
  const mail = state.inbox.find((m) => m.id === emailId);
  if (!mail || !mail.choices) {
    events.push({ type: 'CommandRejected', reason: 'There is nothing to answer in that email' });
    return;
  }
  if (mail.chosen !== undefined) {
    events.push({ type: 'CommandRejected', reason: 'You already answered that one' });
    return;
  }
  const def = EVENTS[mail.kind];
  const choice = def?.choices?.[option];
  if (!def || !choice) {
    events.push({ type: 'CommandRejected', reason: 'That is not one of the answers' });
    return;
  }
  mail.chosen = option;
  mail.read = true;
  for (const e of choice.effects) applyEffect(state, e, events, undefined);
  if (choice.reply) {
    sendEmail(
      state,
      { kind: `${def.id}_reply`, from: def.from, subject: `Re: ${def.subject}`, body: withSignoff(def, choice.reply) },
      events,
    );
  }
}

// ---- Effects ----

function labPlotId(state: GameState): string | null {
  const lab = Object.values(state.plots).find((p) => p.owned && p.roomType === 'lab');
  return lab?.id ?? null;
}

/** Turns one culture bad. A ready one first, then one that is still growing. */
export function contaminateOne(state: GameState, events: SimEvent[]): Culture | null {
  const pick = state.cultures.find((c) => c.status === 'ready') ?? state.cultures.find((c) => c.status === 'growing');
  if (!pick) return null;
  pick.status = 'contaminated';
  pick.growTicksLeft = 0;
  state.flags['lastContaminated'] = true;
  state.stats.contaminations += 1;
  events.push({ type: 'CultureContaminated', cultureId: pick.id });
  return pick;
}

/** A culture went bad on its own: count it and tell the player. */
export function noteContamination(state: GameState, events: SimEvent[]): void {
  state.stats.contaminations += 1;
  fireEvent(state, 'fail_contamination', events, { skipEffects: true });
}

export function applyEffect(state: GameState, e: Effect, events: SimEvent[], params: Record<string, string> | undefined): void {
  const d = state.director;
  switch (e.type) {
    case 'loseStock':
      state.stock[e.item] = Math.max(0, state.stock[e.item] - e.n);
      break;
    case 'giveStock':
      addStock(state, e.item, e.n);
      break;
    case 'funds':
      state.funds += e.n;
      break;
    case 'reputation':
      state.reputation += e.n;
      break;
    case 'data':
      state.data += e.n;
      break;
    case 'flag':
      state.flags[e.key] = e.value;
      break;
    case 'toast':
      events.push({ type: 'Toast', text: e.text });
      break;
    case 'waste': {
      const id = labPlotId(state);
      const plot = id ? state.plots[id] : undefined;
      if (plot) plot.waste += e.n;
      break;
    }
    case 'announceGrant': {
      const def = grantDef(params?.['grantId'] ?? '');
      const call = def ? state.grantCalls[def.id] : undefined;
      if (def && call) {
        call.announced = true;
        call.deadlineDay = def.deadlineDay;
        call.payPercent = 100;
        call.crashes = 0;
      }
      break;
    }
    case 'awardGrant': {
      const def = grantDef(params?.['grantId'] ?? '');
      if (!def) break;
      const pays = Math.round((def.pays * (state.grantCalls[def.id]?.payPercent ?? 100)) / 100);
      state.funds += pays;
      state.reputation += def.reputation;
      events.push({ type: 'GrantAwarded', grantId: def.id });
      events.push({ type: 'Toast', text: `${def.name} awarded! +${pays} Funds` });
      break;
    }
    case 'contaminate':
      contaminateOne(state, events);
      break;
    case 'delayGrowth': {
      const extra = secondsToTicks(e.sec);
      for (const c of state.cultures) if (c.status === 'growing') c.growTicksLeft += extra;
      break;
    }
    case 'benchUpdate': {
      const busy = new Set(Object.values(state.jobs).map((j) => j.stationId));
      const bench = Object.values(state.equipment)
        .filter((q) => q.defId === 'bench' && !busy.has(q.id) && !(q.outTicks && q.outTicks > 0))
        .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))[0];
      if (bench) bench.outTicks = secondsToTicks(e.sec);
      break;
    }
    case 'fullEnergy':
      for (const a of Object.values(state.agents)) {
        if (!a.staff) continue;
        a.staff.energy = ENERGY.max;
        a.staff.workAcc = 0;
      }
      state.flags['moodNow'] = true;
      break;
    case 'fireDrill':
      d.drill = { ticksLeft: secondsToTicks(e.standSec) };
      state.flags['drillMoodTicks'] = secondsToTicks(e.moodSec);
      state.flags['moodNow'] = true;
      staffToDrillSpots(state);
      break;
    case 'wasteRules':
      state.flags['wasteRulesDay'] = state.clock.day;
      d.queue.push({ atT: state.clock.day * TICKS_PER_DAY, eventId: 'admin_waste_rules_end' });
      break;
    case 'visit':
      spawnVisit(state, e.visit, events);
      break;
    case 'later':
      d.queue.push({ atT: timelineTick(state) + secondsToTicks(e.afterSec), eventId: e.event, ...(e.params ? { params: e.params } : params ? { params } : {}) });
      break;
    case 'chance': {
      const list = dChance(state, e.p) ? e.then : (e.otherwise ?? []);
      for (const sub of list) applyEffect(state, sub, events, params);
      break;
    }
    case 'startInspection':
      state.inspection = {
        phase: 'announced',
        visitT: timelineAt(state.clock.day + 1, INSPECTION.visitTick),
        signed: false,
        wasteOk: true,
        cleanOk: true,
        missed: [],
      };
      break;
  }
}
