import { tierStat } from '../../content/equipment';
import type { SimEvent } from '../simEvents';
import { secondsToTicks } from '../ticks';
import { addStock } from '../stock';
import type { Equipment, GameState } from '../types';

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
 * Breakdowns arrive with the failure events in milestone 6.
 */
export function machinesSystem(state: GameState, events: SimEvent[]): void {
  for (const eq of autoclaves(state)) {
    const cycle = eq.cycle;
    if (!cycle) continue;
    if (cycle.ticksLeft > 0) {
      cycle.ticksLeft -= 1;
      if (cycle.ticksLeft > 0) continue;
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
