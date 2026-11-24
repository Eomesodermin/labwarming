import { EQUIPMENT } from '../../content/equipment';
import type { Dir } from '../../sim/types';
import type { PaletteName } from './palette';

/**
 * The single place that says where each sprite comes from. Art comes in three stages
 * (design doc 7.4): `shape` (now), `pixelmap` (milestone 8), `file` (post-v1). Swapping a
 * source here changes the art without touching game code.
 */
export type SpriteSource = { kind: 'shape'; fill: PaletteName; text: PaletteName; label: string };

const equipmentColours: Record<string, { fill: PaletteName; text: PaletteName }> = {
  bench: { fill: 'warmWood', text: 'plum' },
  hood: { fill: 'sky', text: 'plum' },
  incubator: { fill: 'teal', text: 'paper' },
  fridge: { fill: 'paper', text: 'plum' },
  shelf: { fill: 'cocoa', text: 'paper' },
  sink: { fill: 'sky', text: 'plum' },
  bin: { fill: 'slate', text: 'paper' },
  spray: { fill: 'sage', text: 'plum' },
  desk: { fill: 'warmWood', text: 'plum' },
};

export const SPRITES: Record<string, SpriteSource> = {};

for (const def of Object.values(EQUIPMENT)) {
  const c = equipmentColours[def.id] ?? { fill: 'stone', text: 'plum' };
  SPRITES[`equip.${def.id}.t1`] = { kind: 'shape', fill: c.fill, text: c.text, label: def.label };
}

SPRITES['char.player'] = { kind: 'shape', fill: 'terracotta', text: 'plum', label: '' };

export function equipmentSpriteKey(defId: string, tier: number): string {
  return SPRITES[`equip.${defId}.t${tier}`] ? `equip.${defId}.t${tier}` : `equip.${defId}.t1`;
}

export function characterSpriteKey(kind: string): string {
  return SPRITES[`char.${kind}`] ? `char.${kind}` : 'char.player';
}

/** The texture name for one drawn variant of a sprite (a rotation or a facing). */
export function variantKey(spriteKey: string, variant: number | Dir): string {
  return `${spriteKey}#${variant}`;
}
