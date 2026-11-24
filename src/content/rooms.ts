import type { EquipmentDefId, RoomTypeId } from '../sim/types';

export interface RoomDef {
  id: RoomTypeId;
  name: string;
  /** What the plot costs. Buying a second Lab costs this too. */
  cost: number;
  /** Reputation needed to buy. */
  unlockRep: number;
  /** False means the room is listed but cannot be built until a later milestone. */
  available: boolean;
  /** The equipment that may be placed in this room. */
  allows: readonly EquipmentDefId[];
  /** The palette colour of the floor. */
  floor: 'cream' | 'sky' | 'butter' | 'paper' | 'sage';
  note: string;
}

export const ROOMS: Record<RoomTypeId, RoomDef> = {
  lab: {
    id: 'lab',
    name: 'Lab',
    cost: 600,
    unlockRep: 0,
    available: true,
    allows: ['bench', 'hood', 'incubator', 'sink', 'desk', 'fridge', 'shelf', 'bin'],
    floor: 'cream',
    note: 'Where the science happens.',
  },
  washup: {
    id: 'washup',
    name: 'Wash-up Room',
    cost: 400,
    unlockRep: 0,
    available: true,
    allows: ['sink', 'autoclave', 'shelf', 'bin'],
    floor: 'sky',
    note: 'Flasks come back clean.',
  },
  break: {
    id: 'break',
    name: 'Break Room',
    cost: 300,
    unlockRep: 0,
    available: true,
    allows: ['coffee', 'sofa', 'fridge', 'plant'],
    floor: 'butter',
    note: 'Coffee and a sit down.',
  },
  office: {
    id: 'office',
    name: 'Office',
    cost: 350,
    unlockRep: 20,
    available: true,
    allows: ['desk', 'shelf', 'plant'],
    floor: 'paper',
    note: 'Desks here write 25 percent faster.',
  },
  media: {
    id: 'media',
    name: 'Media Facility',
    cost: 800,
    unlockRep: 30,
    available: true,
    allows: ['mediaprep', 'fridge', 'shelf', 'bin'],
    floor: 'sage',
    note: 'Needs a media prep unit to open. A media technician comes with it.',
  },
};

export const ROOM_ORDER: readonly RoomTypeId[] = ['lab', 'washup', 'break', 'office', 'media'];

/** Desks in an Office write this much faster. */
export const OFFICE_WRITE_SPEED = 1.25;

/** Equipment that a room type allows, as names for messages. */
export function roomsAllowing(defId: EquipmentDefId): RoomDef[] {
  return ROOM_ORDER.map((id) => ROOMS[id]).filter((r) => r.allows.includes(defId));
}
