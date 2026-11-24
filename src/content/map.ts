import type { Dir, Point, Rot } from '../sim/types';

// The fixed floor plan. Legend: # wall, D door, = corridor, E entrance, . outside,
// letters a to f are plot interiors (8 by 6 tiles each). Rows 9 and 10 are both corridor.
export const MAP_ROWS: readonly string[] = [
  '..............................', // 0
  '.############################.', // 1
  '.#aaaaaaaa#bbbbbbbb#cccccccc#.', // 2
  '.#aaaaaaaa#bbbbbbbb#cccccccc#.', // 3
  '.#aaaaaaaa#bbbbbbbb#cccccccc#.', // 4
  '.#aaaaaaaa#bbbbbbbb#cccccccc#.', // 5
  '.#aaaaaaaa#bbbbbbbb#cccccccc#.', // 6
  '.#aaaaaaaa#bbbbbbbb#cccccccc#.', // 7
  '.####D########D########D#####.', // 8
  '.E==========================#.', // 9
  '.E==========================#.', // 10
  '.####D########D########D#####.', // 11
  '.#dddddddd#eeeeeeee#ffffffff#.', // 12
  '.#dddddddd#eeeeeeee#ffffffff#.', // 13
  '.#dddddddd#eeeeeeee#ffffffff#.', // 14
  '.#dddddddd#eeeeeeee#ffffffff#.', // 15
  '.#dddddddd#eeeeeeee#ffffffff#.', // 16
  '.#dddddddd#eeeeeeee#ffffffff#.', // 17
  '.############################.', // 18
  '..............................', // 19
];

export const MAP_W = 30;
export const MAP_H = 20;
export const TILE_SIZE = 16;

export interface PlotDef {
  id: string;
  /** Top-left tile of the interior. */
  x: number;
  y: number;
  w: number;
  h: number;
  door: Point;
}

export const PLOTS: readonly PlotDef[] = [
  { id: 'a', x: 2, y: 2, w: 8, h: 6, door: { x: 5, y: 8 } },
  { id: 'b', x: 11, y: 2, w: 8, h: 6, door: { x: 14, y: 8 } },
  { id: 'c', x: 20, y: 2, w: 8, h: 6, door: { x: 23, y: 8 } },
  { id: 'd', x: 2, y: 12, w: 8, h: 6, door: { x: 5, y: 11 } },
  { id: 'e', x: 11, y: 12, w: 8, h: 6, door: { x: 14, y: 11 } },
  { id: 'f', x: 20, y: 12, w: 8, h: 6, door: { x: 23, y: 11 } },
];

/** Plot a is the starting Lab. */
export const START_PLOT = 'a';

export const DELIVERY_BAY: Point = { x: 2, y: 9 };
export const WASTE_POINT: Point = { x: 2, y: 10 };
/** Visitors, couriers and new staff enter here. */
export const ENTRANCE: Point = { x: 1, y: 9 };

export const PLAYER_START: Point & { facing: Dir } = { x: 5, y: 5, facing: 'down' };

export interface StartingEquipment {
  defId: string;
  x: number;
  y: number;
  rot: Rot;
  tier: number;
}

/** The starting Lab layout (design doc 4.1). Everything faces into the room. */
export const START_EQUIPMENT: readonly StartingEquipment[] = [
  { defId: 'hood', x: 2, y: 2, rot: 0, tier: 1 },
  { defId: 'bench', x: 5, y: 2, rot: 0, tier: 1 },
  { defId: 'incubator', x: 8, y: 2, rot: 0, tier: 1 },
  { defId: 'fridge', x: 9, y: 2, rot: 0, tier: 1 },
  { defId: 'shelf', x: 9, y: 4, rot: 1, tier: 1 },
  { defId: 'sink', x: 2, y: 7, rot: 2, tier: 1 },
  { defId: 'bin', x: 3, y: 7, rot: 2, tier: 1 },
  { defId: 'spray', x: 6, y: 7, rot: 2, tier: 1 },
  { defId: 'desk', x: 8, y: 7, rot: 2, tier: 1 },
];
