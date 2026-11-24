import type { EquipmentDefId } from '../sim/types';

export interface Upgrade {
  /** Price to go from the previous tier to this one. */
  price: number;
  /** Reputation needed, if any. */
  rep?: number;
}

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
  /** What it costs to build. Null means it cannot be bought (the spray station comes free, the bay is fixed). */
  price: number | null;
  /** The upgrades to tier 2, then tier 3. Empty if there are none. */
  upgrades: readonly Upgrade[];
  /** Where it shows in the build panel. 'fixed' items are not in the catalogue. */
  category: 'equipment' | 'decor' | 'fixed';
}

export const EQUIPMENT: Record<EquipmentDefId, EquipmentDef> = {
  bench: {
    id: 'bench',
    name: 'Bench',
    label: 'BENCH',
    w: 2,
    h: 1,
    stats: { experimentSec: [15, 12, 10], experimentData: [10, 14, 20] },
    price: 200,
    upgrades: [{ price: 300 }, { price: 700, rep: 60 }],
    category: 'equipment',
  },
  hood: {
    id: 'hood',
    name: 'Hood',
    label: 'HOOD',
    w: 2,
    h: 1,
    stats: { splitSec: [10, 7], contaminationMult: [1, 0.5] },
    price: 250,
    upgrades: [{ price: 350 }],
    category: 'equipment',
  },
  incubator: {
    id: 'incubator',
    name: 'Incubator',
    label: 'INC',
    w: 1,
    h: 1,
    stats: { slots: [2, 4, 8], growSec: [45, 45, 35] },
    price: 150,
    upgrades: [{ price: 250 }, { price: 500, rep: 60 }],
    category: 'equipment',
  },
  fridge: {
    id: 'fridge',
    name: 'Fridge',
    label: 'FRG',
    w: 1,
    h: 1,
    // Cold capacity once repaired. A broken fridge holds `brokenCapacity` instead.
    stats: { capacity: [16, 32], brokenCapacity: [8, 8] },
    price: 200,
    upgrades: [{ price: 300 }],
    category: 'equipment',
  },
  shelf: {
    id: 'shelf',
    name: 'Shelf',
    label: 'SHELF',
    w: 2,
    h: 1,
    stats: { capacity: [12, 24] },
    price: 80,
    upgrades: [{ price: 150 }],
    category: 'equipment',
  },
  sink: {
    id: 'sink',
    name: 'Sink',
    label: 'SNK',
    w: 1,
    h: 1,
    stats: { washSec: [5, 3] },
    price: 100,
    upgrades: [{ price: 150 }],
    category: 'equipment',
  },
  bin: {
    id: 'bin',
    name: 'Waste bin',
    label: 'BIN',
    w: 1,
    h: 1,
    stats: { capacity: [8, 16] },
    price: 40,
    upgrades: [{ price: 80 }],
    category: 'equipment',
  },
  spray: { id: 'spray', name: 'Spray station', label: 'SPR', w: 1, h: 1, price: null, upgrades: [], category: 'fixed' },
  desk: {
    id: 'desk',
    name: 'Desk',
    label: 'DESK',
    w: 2,
    h: 1,
    // Writing speed: desk jobs take their normal time divided by this.
    stats: { speed: [1, 1.25] },
    price: 120,
    upgrades: [{ price: 200 }],
    category: 'equipment',
  },
  autoclave: {
    id: 'autoclave',
    name: 'Autoclave',
    label: 'AUTO',
    w: 2,
    h: 1,
    // Flasks per cycle, seconds to load by hand, and seconds of unattended running.
    stats: { capacity: [8, 16], loadSec: [6, 6], cycleSec: [40, 30] },
    price: 300,
    upgrades: [{ price: 400 }],
    category: 'equipment',
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee machine',
    label: 'COF',
    w: 1,
    h: 1,
    // Seconds for a break, and the Mood bonus while the machine exists.
    stats: { breakSec: [20, 12], mood: [10, 10] },
    price: 150,
    upgrades: [{ price: 250 }],
    category: 'equipment',
  },
  sofa: { id: 'sofa', name: 'Sofa', label: 'SOFA', w: 2, h: 1, stats: { mood: [10] }, price: 100, upgrades: [], category: 'decor' },
  plant: { id: 'plant', name: 'Plant', label: 'PLT', w: 1, h: 1, stats: { mood: [2] }, price: 30, upgrades: [], category: 'decor' },
  // The Media Facility's unit. It makes media bottles, one at a time, from powder.
  mediaprep: {
    id: 'mediaprep',
    name: 'Media prep unit',
    label: 'PREP',
    w: 2,
    h: 1,
    price: 400,
    upgrades: [],
    category: 'equipment',
  },
  // The delivery bay in the corridor. Boxes wait here until someone puts them away.
  bay: { id: 'bay', name: 'Delivery bay', label: 'BAY', w: 1, h: 1, price: null, upgrades: [], category: 'fixed' },
};

/** The highest tier a piece of equipment can reach. */
export function maxTier(defId: EquipmentDefId): number {
  return 1 + (EQUIPMENT[defId]?.upgrades.length ?? 0);
}

/** Total Funds paid for an item at a tier: its price plus every upgrade up to that tier. */
export function investedFunds(defId: EquipmentDefId, tier: number): number {
  const def = EQUIPMENT[defId];
  if (!def || def.price === null) return 0;
  let total = def.price;
  for (let t = 2; t <= tier; t++) total += def.upgrades[t - 2]?.price ?? 0;
  return total;
}

/** A tier-dependent number for a piece of equipment. Returns `fallback` if the stat does not exist. */
export function tierStat(defId: EquipmentDefId, key: string, tier: number, fallback = 0): number {
  const list = EQUIPMENT[defId]?.stats?.[key];
  if (!list || list.length === 0) return fallback;
  return list[Math.min(Math.max(tier, 1), list.length) - 1] ?? fallback;
}
