import { tierStat } from '../content/equipment';
import { COLD_ITEMS, DRY_ITEMS, type StockItem } from '../content/items';
import { baseTile } from './grid';
import type { Equipment, GameState } from './types';

/** The plot a piece of equipment stands in, by its top-left tile. */
export function plotOf(eq: Equipment): string | null {
  return baseTile(eq.x, eq.y).plotId;
}

export function coldCapacity(state: GameState): number {
  let cap = 0;
  for (const eq of Object.values(state.equipment)) {
    if (eq.defId !== 'fridge') continue;
    cap += tierStat('fridge', eq.broken ? 'brokenCapacity' : 'capacity', eq.tier);
  }
  return cap;
}

export function dryCapacity(state: GameState): number {
  let cap = 0;
  for (const eq of Object.values(state.equipment)) if (eq.defId === 'shelf') cap += tierStat('shelf', 'capacity', eq.tier);
  return cap;
}

export function coldUsed(state: GameState): number {
  return COLD_ITEMS.reduce((n, k) => n + state.stock[k], 0);
}

export function dryUsed(state: GameState): number {
  return DRY_ITEMS.reduce((n, k) => n + state.stock[k], 0);
}

export function coldFree(state: GameState): number {
  return Math.max(0, coldCapacity(state) - coldUsed(state));
}

export function dryFree(state: GameState): number {
  return Math.max(0, dryCapacity(state) - dryUsed(state));
}

/** Free storage space for an item. Dirty flasks have no limit. */
export function freeSpaceFor(state: GameState, item: StockItem): number {
  if (COLD_ITEMS.includes(item)) return coldFree(state);
  if (DRY_ITEMS.includes(item)) return dryFree(state);
  return Number.POSITIVE_INFINITY;
}

/** Adds as many as fit. Returns how many were added. */
export function addStock(state: GameState, item: StockItem, n: number): number {
  const added = Math.min(n, freeSpaceFor(state, item));
  state.stock[item] += added;
  return added;
}

export function wasteCapacity(state: GameState, plotId: string): number {
  let cap = 0;
  for (const eq of Object.values(state.equipment)) {
    if (eq.defId === 'bin' && plotOf(eq) === plotId) cap += tierStat('bin', 'capacity', eq.tier);
  }
  return cap;
}

export function binFull(state: GameState, plotId: string): boolean {
  return (state.plots[plotId]?.waste ?? 0) >= wasteCapacity(state, plotId);
}

/** Why an item cannot be put away right now. */
export function storageFullReason(state: GameState, item: StockItem): string {
  if (COLD_ITEMS.includes(item)) {
    const broken = Object.values(state.equipment).some((e) => e.defId === 'fridge' && e.broken);
    return broken ? 'The fridge is full. It is broken and holds less. Repair it at the fridge' : 'The fridge is full. Use some stock first';
  }
  return 'The shelf is full. Use some stock first';
}
