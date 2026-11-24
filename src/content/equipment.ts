import type { EquipmentDefId } from '../sim/types';

export interface EquipmentDef {
  id: EquipmentDefId;
  name: string;
  /** Short label drawn on the Stage A placeholder shape. */
  label: string;
  /** Footprint at rotation 0 and 2. Rotations 1 and 3 swap width and height. */
  w: number;
  h: number;
  /**
   * Numbers that change with the upgrade tier. Each list is indexed by tier minus one.
   * A tier past the end of a list uses the last entry. Design doc 4.2.
   */
  stats?: Record<string, readonly number[]>;
}

export const EQUIPMENT: Record<EquipmentDefId, EquipmentDef> = {
  bench: {
    id: 'bench',
    name: 'Bench',
    label: 'BENCH',
    w: 2,
    h: 1,
    stats: { experimentSec: [15, 12, 10], experimentData: [10, 14, 20] },
  },
  hood: {
    id: 'hood',
    name: 'Hood',
    label: 'HOOD',
    w: 2,
    h: 1,
    stats: { splitSec: [10, 7], contaminationMult: [1, 0.5] },
  },
  incubator: {
    id: 'incubator',
    name: 'Incubator',
    label: 'INC',
    w: 1,
    h: 1,
    stats: { slots: [2, 4, 8], growSec: [45, 45, 35] },
  },
  fridge: {
    id: 'fridge',
    name: 'Fridge',
    label: 'FRG',
    w: 1,
    h: 1,
    // Cold capacity once repaired. A broken fridge holds `brokenCapacity` instead.
    stats: { capacity: [16, 32], brokenCapacity: [8, 8] },
  },
  shelf: { id: 'shelf', name: 'Shelf', label: 'SHELF', w: 2, h: 1, stats: { capacity: [12, 24] } },
  sink: { id: 'sink', name: 'Sink', label: 'SNK', w: 1, h: 1, stats: { washSec: [5, 3] } },
  bin: { id: 'bin', name: 'Waste bin', label: 'BIN', w: 1, h: 1, stats: { capacity: [8, 16] } },
  spray: { id: 'spray', name: 'Spray station', label: 'SPR', w: 1, h: 1 },
  desk: { id: 'desk', name: 'Desk', label: 'DESK', w: 2, h: 1 },
};

/** A tier-dependent number for a piece of equipment. Returns `fallback` if the stat does not exist. */
export function tierStat(defId: EquipmentDefId, key: string, tier: number, fallback = 0): number {
  const list = EQUIPMENT[defId]?.stats?.[key];
  if (!list || list.length === 0) return fallback;
  return list[Math.min(Math.max(tier, 1), list.length) - 1] ?? fallback;
}
