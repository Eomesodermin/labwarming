import { TICKS_PER_DAY, TICKS_PER_SECOND } from '../../content/balance';
import { GRANTS } from '../../content/economy';
import {
  DIRECTOR,
  EVENTS,
  EVENT_IDS,
  FAILURES,
  REQUESTS,
  SCRIPTED_BEATS,
  hourToTick,
  PI_NAME,
  type ScriptedBeat,
} from '../../content/events';
import { sendEmail } from '../email';
import type { SimEvent } from '../simEvents';
import { binFull, wasteCapacity } from '../stock';
import { secondsToTicks, timelineTick } from '../ticks';
import type { ActiveRequest, GameState } from '../types';
import { canFire, checkCondition, dChance, dFloat, fireEvent } from './eventCore';

const NO_FAILURE_TICKS = DIRECTOR.noFailureSec * TICKS_PER_SECOND;
const FAILURE_GAP_TICKS = DIRECTOR.failureGapSec * TICKS_PER_SECOND;
const RANDOM_GAP_TICKS = DIRECTOR.randomGapSec * TICKS_PER_SECOND;

/** True when random failures may fire: not in the first 6 minutes of a save. */
export function failuresAllowed(state: GameState): boolean {
  return state.tick >= NO_FAILURE_TICKS;
}

function requestProgress(state: GameState, req: ActiveRequest): boolean {
  return req.needs.every((n) => {
    const now = n.stat === 'presentations' ? state.stats.presentations : n.stat === 'splits' ? state.stats.splits : state.stats.experiments;
    return now - n.base >= n.target;
  });
}

/** Completes requests whose work is done, and ends the ones that ran out of time. */
function requestsStep(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  if (d.requests.length === 0) return;
  const T = timelineTick(state);
  for (const req of [...d.requests]) {
    const def = REQUESTS[req.id];
    if (!def) {
      d.requests = d.requests.filter((r) => r !== req);
      continue;
    }
    if (requestProgress(state, req)) {
      const r = def.reward;
      if (r.funds) state.funds += r.funds;
      if (r.data) state.data += r.data;
      state.reputation += r.reputation;
      state.stats.requestsDone += 1;
      d.resolved[req.id] = 'done';
      d.requests = d.requests.filter((x) => x !== req);
      const parts = [r.funds ? `+${r.funds} Funds` : '', r.data ? `+${r.data} Data` : '', `+${r.reputation} Reputation`].filter(Boolean);
      sendEmail(state, { kind: `${req.id}_done`, from: PI_NAME, subject: 'Re: done already?', body: `${def.doneText}\n\n${parts.join(', ')}.\n\nBest, W\nSent from my phone` }, events);
      events.push({ type: 'Toast', text: `Request done! ${parts.join(', ')}` });
    } else if (T >= req.dueT) {
      state.funds += def.missFunds;
      state.stats.requestsMissed += 1;
      d.resolved[req.id] = 'missed';
      d.requests = d.requests.filter((x) => x !== req);
      sendEmail(state, { kind: `${req.id}_missed`, from: PI_NAME, subject: 'Re: no worries', body: `${def.missText}\n\n+${def.missFunds} Funds.\n\nBest, W\nSent from my phone` }, events);
    }
  }
}

/** The day a recurring beat last came round, or its one day. */
function occurrenceDay(b: ScriptedBeat, day: number): number {
  if (!b.everyDays || day < b.day) return b.day;
  return b.day + Math.floor((day - b.day) / b.everyDays) * b.everyDays;
}

function beatsStep(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  const { day, tickOfDay } = state.clock;
  for (const b of SCRIPTED_BEATS) {
    if (day < b.day) continue;
    const occ = occurrenceDay(b, day);
    const key = b.everyDays ? `${b.key}@${occ}` : b.key;
    if (d.firedBeats.includes(key)) continue;
    const due = day > occ ? !b.everyDays : tickOfDay >= hourToTick(b.hour);
    if (!due) continue;
    const def = EVENTS[b.event];
    if (!def || !canFire(state, def)) continue;
    d.firedBeats.push(key);
    // pool conditions such as beatFired look for the event id, so record that too
    if (!d.firedBeats.includes(b.event)) d.firedBeats.push(b.event);
    fireEvent(state, b.event, events, b.params ? { params: b.params } : {});
  }
}

/** The warm fridge, nags, bins filling up. Rules that are not a single scripted time. */
function rulesStep(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  const { day, tickOfDay } = state.clock;
  const T = timelineTick(state);

  // fail_fridge_warm: 13:00, at most once a day, while the fridge is broken.
  if (tickOfDay >= DIRECTOR.fridgeWarmTick && state.flags['fridgeWarmDay'] !== day && Object.values(state.equipment).some((e) => e.defId === 'fridge' && e.broken)) {
    state.flags['fridgeWarmDay'] = day;
    fireEvent(state, 'fail_fridge_warm', events);
  }

  // grant_nag: 09:00 on each of the last 2 days before a deadline.
  if (tickOfDay >= DIRECTOR.nagTick) {
    for (const g of GRANTS) {
      const call = state.grantCalls[g.id];
      if (!call?.announced || call.deadlineDay === null || state.grants[g.id]) continue;
      if (day !== call.deadlineDay - 1 && day !== call.deadlineDay) continue;
      const key = `nag:${g.id}:${day}`;
      if (d.firedBeats.includes(key)) continue;
      d.firedBeats.push(key);
      fireEvent(state, 'grant_nag', events, { params: { grantId: g.id } });
    }
  }

  // fail_bin_full: a bin reaches capacity.
  const nowFull = Object.values(state.plots)
    .filter((p) => p.owned && wasteCapacity(state, p.id) > 0 && binFull(state, p.id))
    .map((p) => p.id);
  for (const id of nowFull) {
    if (d.binsFull.includes(id)) continue;
    const ok = failuresAllowed(state) && (d.cooldowns['fail_bin_full'] ?? 0) <= T;
    if (ok) {
      d.cooldowns['fail_bin_full'] = T + FAILURES.binFullCooldownDays * TICKS_PER_DAY;
      fireEvent(state, 'fail_bin_full', events);
    }
  }
  d.binsFull = nowFull;
}

/** Events that were set for later: the cake, the end of the waste memo. */
function queueStep(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  if (d.queue.length === 0) return;
  const T = timelineTick(state);
  const due = d.queue.filter((q) => q.atT <= T);
  if (due.length === 0) return;
  d.queue = d.queue.filter((q) => q.atT > T);
  for (const q of due) fireEvent(state, q.eventId, events, q.params ? { params: q.params } : {});
}

/** The random pool: at most one event every 90 s, failures only after 6 minutes and 120 s apart. */
function poolStep(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  const T = timelineTick(state);
  if (!d.firedBeats.includes(DIRECTOR.poolOpensAfterBeat)) return;
  if (T - d.lastRandomT < RANDOM_GAP_TICKS) return;
  if (state.tick % secondsToTicks(DIRECTOR.checkEverySec) !== 0) return;
  if (!dChance(state, DIRECTOR.chancePerCheck)) return;
  const eligible = EVENT_IDS.map((id) => EVENTS[id]).filter((def) => {
    if (!def || !def.pool) return false;
    if (!canFire(state, def)) return false;
    if (!(def.pool.needs ?? []).every((c) => checkCondition(state, c))) return false;
    if ((d.cooldowns[def.id] ?? 0) > T) return false;
    if (def.failure && (!failuresAllowed(state) || T - d.lastFailureT < FAILURE_GAP_TICKS)) return false;
    return true;
  });
  if (eligible.length === 0) return;
  let total = 0;
  for (const def of eligible) total += def?.pool?.weight ?? 0;
  let roll = dFloat(state) * total;
  let pick = eligible[0];
  for (const def of eligible) {
    roll -= def?.pool?.weight ?? 0;
    if (roll < 0) {
      pick = def;
      break;
    }
  }
  if (!pick || !pick.pool) return;
  d.lastRandomT = T;
  d.cooldowns[pick.id] = T + pick.pool.cooldownDays * TICKS_PER_DAY;
  fireEvent(state, pick.id, events);
}

/** Counts down the small timers: cake, the fire drill mood, bench updates and the engineer. */
function upkeep(state: GameState, events: SimEvent[]): void {
  const d = state.director;
  state.flags['piRequest'] = d.requests.length > 0;
  for (const key of ['cakeTicks', 'drillMoodTicks']) {
    const v = state.flags[key];
    if (typeof v === 'number' && v > 0) state.flags[key] = v - 1;
  }
  if (d.cake && !(typeof state.flags['cakeTicks'] === 'number' && state.flags['cakeTicks'] > 0)) d.cake = null;
  for (const eq of Object.values(state.equipment)) {
    if (eq.outTicks && eq.outTicks > 0) {
      eq.outTicks -= 1;
      if (eq.outTicks === 0) events.push({ type: 'Toast', text: 'The bench computer finished its updates. 47 of 47' });
    }
    if (eq.repairTicks && eq.repairTicks > 0) {
      eq.repairTicks -= 1;
      if (eq.repairTicks === 0) {
        eq.broken = false;
        events.push({ type: 'Toast', text: 'The engineer fixed the autoclave. She would not say what she did' });
      }
    }
  }
}

/**
 * The event director (design doc 6.2). It fires the scripted beats of the first week, then draws
 * from the random pool, and runs the small rules (the warm fridge, nags, bins). All text, numbers
 * and effects are rows in `content/events.ts`.
 */
export function directorSystem(state: GameState, events: SimEvent[]): void {
  upkeep(state, events);
  queueStep(state, events);
  requestsStep(state, events);
  if (state.tick % 5 !== 0) return;
  beatsStep(state, events);
  rulesStep(state, events);
  poolStep(state, events);
}

