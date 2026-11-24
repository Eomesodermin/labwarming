import { tierStat } from '../../content/equipment';
import { FAILURES } from '../../content/events';
import type { SimEvent } from '../simEvents';
import { secondsToTicks } from '../ticks';
import { addStock } from '../stock';
import type { Equipment, GameState } from '../types';
import { failuresAllowed } from './director';
import { dChance, fireEvent } from './eventCore';

export function autoclaves(state: GameState): Equipment[] {
  return Object.values(state.equipment).filter((e) => e.defId === 'autoclave');
}

export function autoclaveCapacity(eq: Equipment): number {
  return tierStat('autoclave', 'capacity', eq.tier);
}

/** Starts a cycle with this many dirty flasks. */
export function startCycle(eq: Equipment, flasks: number): void {
  eq.cycle = { flasks, ticksLeft: secondsToTicks(tierStat('autoclave', 'cycleSec', eq.tier)) };
}

/**
 * Autoclaves run unattended. When the time is up, the flasks go onto the shelf as clean flasks.
 * If the shelf is full, the rest wait inside and come out as soon as there is room.
 * A tier 1 autoclave may break when a cycle ends (design doc 6.3): the flasks stay inside until
 * it is coaxed back or the engineer comes.
 */
export function machinesSystem(state: GameState, events: SimEvent[]): void {
  for (const eq of autoclaves(state)) {
    const cycle = eq.cycle;
    if (!cycle || eq.broken) continue;
    if (cycle.ticksLeft > 0) {
      cycle.ticksLeft -= 1;
      if (cycle.ticksLeft > 0) continue;
      if (breaks(state, eq)) {
        eq.broken = true;
        fireEvent(state, 'fail_autoclave', events);
        continue;
      }
    }
    const before = cycle.flasks;
    const out = addStock(state, 'cleanFlasks', cycle.flasks);
    cycle.flasks -= out;
    if (out > 0 && cycle.flasks === 0) {
      eq.cycle = null;
      state.stats.autoclaveCycles += 1;
      events.push({ type: 'Toast', text: `Autoclave done: ${before} clean flasks` });
    }
  }
}

/** Tier 1, after its first 3 cycles, 5 percent per cycle, and never in the first 6 minutes. */
function breaks(state: GameState, eq: Equipment): boolean {
  const f = FAILURES.autoclave;
  if (eq.tier !== 1 || state.stats.autoclaveCycles < f.safeCycles || !failuresAllowed(state)) return false;
  return dChance(state, f.chancePerCycle);
}

/** A hopeful thump on the side. It works half the time. */
export function coax(state: GameState, equipmentId: string, events: SimEvent[]): void {
  const eq = state.equipment[equipmentId];
  if (!eq || eq.defId !== 'autoclave' || !eq.broken) {
    events.push({ type: 'CommandRejected', reason: 'Nothing to coax' });
    return;
  }
  if (eq.repairTicks && eq.repairTicks > 0) {
    events.push({ type: 'CommandRejected', reason: 'The engineer is already on the way' });
    return;
  }
  if (dChance(state, FAILURES.autoclave.coaxChance)) {
    eq.broken = false;
    events.push({ type: 'Toast', text: 'You pat the autoclave. It hums again. You are not sure what you did' });
  } else {
    events.push({ type: 'Toast', text: 'It made a different noise. Try again, or call the engineer' });
  }
}

/** What the next engineer call costs: the first one is free. */
export function engineerPrice(state: GameState): number {
  return state.director.engineerCalls < FAILURES.autoclave.engineerFreeCalls ? 0 : FAILURES.autoclave.engineerPrice;
}

/** Calls the engineer from a desk. She arrives in 30 s and fixes it. */
export function callEngineer(state: GameState, events: SimEvent[]): void {
  const eq = autoclaves(state).find((e) => e.broken);
  if (!eq) {
    events.push({ type: 'CommandRejected', reason: 'Nothing is broken' });
    return;
  }
  if (eq.repairTicks && eq.repairTicks > 0) {
    events.push({ type: 'CommandRejected', reason: 'The engineer is already on the way' });
    return;
  }
  const price = engineerPrice(state);
  if (state.funds < price) {
    events.push({ type: 'CommandRejected', reason: `Needs ${price} Funds` });
    return;
  }
  state.funds -= price;
  state.director.engineerCalls += 1;
  eq.repairTicks = secondsToTicks(FAILURES.autoclave.engineerSec);
  events.push({ type: 'Purchase', what: 'Engineer' });
  events.push({ type: 'Toast', text: `The engineer is on the way. About ${FAILURES.autoclave.engineerSec} s${price === 0 ? ', and the first call is free' : ''}` });
}
