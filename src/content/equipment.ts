import type { EquipmentDefId } from '../sim/types';

export interface EquipmentDef {
  id: EquipmentDefId;
  name: string;
  /** Short label drawn on the Stage A placeholder shape. */
  label: string;
  /** Footprint at rotation 0 and 2. Rotations 1 and 3 swap width and height. */
  w: number;
  h: number;
}

export const EQUIPMENT: Record<EquipmentDefId, EquipmentDef> = {
  bench: { id: 'bench', name: 'Bench', label: 'BENCH', w: 2, h: 1 },
  hood: { id: 'hood', name: 'Hood', label: 'HOOD', w: 2, h: 1 },
  incubator: { id: 'incubator', name: 'Incubator', label: 'INC', w: 1, h: 1 },
  fridge: { id: 'fridge', name: 'Fridge', label: 'FRIDGE', w: 1, h: 1 },
  shelf: { id: 'shelf', name: 'Shelf', label: 'SHELF', w: 2, h: 1 },
  sink: { id: 'sink', name: 'Sink', label: 'SINK', w: 1, h: 1 },
  bin: { id: 'bin', name: 'Waste bin', label: 'BIN', w: 1, h: 1 },
  spray: { id: 'spray', name: 'Spray station', label: 'SPRAY', w: 1, h: 1 },
  desk: { id: 'desk', name: 'Desk', label: 'DESK', w: 2, h: 1 },
};
