import { TUNING } from '../../content/jobs';
import { tierStat } from '../../content/equipment';
import { chance } from '../rng';
import type { SimEvent } from '../simEvents';
import { plotOf } from '../stock';
import type { Equipment, GameState } from '../types';

export function incubators(state: GameState): Equipment[] {
  return Object.values(state.equipment)
    .filter((e) => e.defId === 'incubator')
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

export function slotsOf(eq: Equipment): number {
  return tierStat('incubator', 'slots', eq.tier);
}

/** The first incubator that has a free slot, or null. */
export function incubatorWithFreeSlot(state: GameState): Equipment | null {
  for (const inc of incubators(state)) {
    const used = state.cultures.filter((c) => c.incubatorId === inc.id).length;
    if (used < slotsOf(inc)) return inc;
  }
  return null;
}

/** Chance that a culture that just finished growing is contaminated (design doc 4.7). */
export function contaminationChance(state: GameState, incubator: Equipment | undefined): number {
  const t = TUNING.contamination;
  const plot = incubator ? state.plots[plotOf(incubator) ?? ''] : undefined;
  let p: number = t.base;
  if (plot && plot.cleanliness < t.dirtyRoomBelow) p += t.dirtyRoomExtra;
  // The hood's tier halves it. Golden Hands joins in with staff.
  const hood = Object.values(state.equipment).find((e) => e.defId === 'hood');
  if (hood) p *= tierStat('hood', 'contaminationMult', hood.tier, 1);
  return p;
}

/**
 * Cultures grow one tick at a time. When one finishes it rolls for contamination.
 * Never in the first N cultures of a save. Never twice in a row.
 */
export function culturesSystem(state: GameState, events: SimEvent[]): void {
  for (const c of state.cultures) {
    if (c.status !== 'growing') continue;
    c.growTicksLeft -= 1;
    if (c.growTicksLeft > 0) continue;
    c.growTicksLeft = 0;
    state.stats.culturesGrown += 1;
    const incubator = state.equipment[c.incubatorId];
    const roll = chance(state, contaminationChance(state, incubator)); // always draws, so the stream stays steady
    const eligible = state.stats.culturesGrown > TUNING.contamination.safeCultures && state.flags['lastContaminated'] !== true;
    if (roll && eligible) {
      c.status = 'contaminated';
      state.flags['lastContaminated'] = true;
      events.push({ type: 'CultureContaminated', cultureId: c.id });
    } else {
      c.status = 'ready';
      state.flags['lastContaminated'] = false;
      events.push({ type: 'CultureReady', cultureId: c.id });
    }
  }
}
