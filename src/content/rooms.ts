import type { RoomTypeId } from '../sim/types';

export interface RoomDef {
  id: RoomTypeId;
  name: string;
}

export const ROOMS: Record<RoomTypeId, RoomDef> = {
  lab: { id: 'lab', name: 'Lab' },
  washup: { id: 'washup', name: 'Wash-up Room' },
  break: { id: 'break', name: 'Break Room' },
  office: { id: 'office', name: 'Office' },
  media: { id: 'media', name: 'Media Facility' },
};
