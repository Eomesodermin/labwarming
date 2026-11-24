import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from '../../src/content/equipment';
import { LEGEND } from '../../src/view/art/pixelmap';
import { SPRITES } from '../../src/view/art/spriteRegistry';
import { CHAR_BASE, CHAR_OVERLAYS } from '../../src/view/art/sprites/characters';
import { EQUIPMENT_ART } from '../../src/view/art/sprites/equipment';

const SLOTS = 'HhSWUVATLFG';
const okLetter = (ch: string, extra = ''): boolean => ch === '.' || ch in LEGEND || extra.includes(ch);

describe('sprite art', () => {
  it('draws every piece of equipment at its full footprint', () => {
    for (const def of Object.values(EQUIPMENT)) {
      const rows = EQUIPMENT_ART[def.id];
      expect(rows, def.id).toBeDefined();
      expect(rows?.length, def.id).toBe(def.h * 16);
      for (const r of rows ?? []) expect(r.length, def.id).toBe(def.w * 16);
    }
  });

  it('uses only palette letters in every pixel-map sprite', () => {
    for (const [key, src] of Object.entries(SPRITES)) {
      const w = src.rows[0]?.length ?? 0;
      for (const r of src.rows) {
        expect(r.length, key).toBe(w);
        for (const ch of r) expect(okLetter(ch, key.startsWith('tile.floor') ? '123' : ''), `${key} ${ch}`).toBe(true);
      }
    }
  });

  it('keeps character frames 16 by 24 and overlays inside them', () => {
    for (const [k, rows] of Object.entries(CHAR_BASE)) {
      expect(rows.length, k).toBe(24);
      for (const r of rows) {
        expect(r.length, k).toBe(16);
        for (const ch of r) expect(okLetter(ch, SLOTS), k).toBe(true);
      }
    }
    for (const [name, views] of Object.entries(CHAR_OVERLAYS)) {
      for (const [v, ov] of Object.entries(views)) {
        expect(ov.y + ov.rows.length, `${name}.${v}`).toBeLessThanOrEqual(24);
        for (const r of ov.rows) {
          expect(r.length, `${name}.${v}`).toBe(16);
          for (const ch of r) expect(okLetter(ch, SLOTS), `${name}.${v}`).toBe(true);
        }
      }
    }
  });
});
