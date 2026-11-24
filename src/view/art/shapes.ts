import Phaser from 'phaser';
import { EQUIPMENT } from '../../content/equipment';
import { TILE_SIZE } from '../../content/map';
import type { Dir, Rot } from '../../sim/types';
import { PALETTE_HEX, type PaletteName } from './palette';
import { SPRITES, variantKey, type SpriteSource } from './spriteRegistry';

const C = (n: PaletteName): string => PALETTE_HEX[n];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Stage A equipment: a rounded rectangle with a plum outline, a label and a dot on the front edge. */
function drawEquipment(scene: Phaser.Scene, key: string, src: SpriteSource, w: number, h: number, rot: Rot): void {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 3);
  ctx.fillStyle = C(src.fill);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C('plum');
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = C(src.text);
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(w / 2, h / 2 + 0.5);
  if (h > w) ctx.rotate(-Math.PI / 2);
  ctx.fillText(src.label, 0, 0);
  ctx.restore();

  // Facing dot on the front edge, so you can see where to stand.
  ctx.fillStyle = C('mustard');
  const dot = (x: number, y: number): void => {
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
  };
  if (rot === 0) dot(w / 2, h - 2);
  else if (rot === 2) dot(w / 2, 2);
  else if (rot === 1) dot(2, h / 2);
  else dot(w - 2, h / 2);
  tex.refresh();
}

/** Stage A character: a body, a head and a dot showing which way they face. 16 by 24, feet at the bottom. */
function drawCharacter(scene: Phaser.Scene, key: string, src: SpriteSource, facing: Dir): void {
  const tex = scene.textures.createCanvas(key, 16, 24);
  if (!tex) return;
  const ctx = tex.getContext();
  // Ground shadow, then body.
  ctx.fillStyle = 'rgba(74, 53, 64, 0.25)';
  ctx.beginPath();
  ctx.ellipse(8, 22, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, 3.5, 11.5, 9, 10, 3);
  ctx.fillStyle = C(src.fill);
  ctx.fill();
  ctx.strokeStyle = C('plum');
  ctx.lineWidth = 1;
  ctx.stroke();
  // Head.
  ctx.beginPath();
  ctx.arc(8, 7, 5, 0, Math.PI * 2);
  ctx.fillStyle = C('butter');
  ctx.fill();
  ctx.stroke();
  // Facing dot.
  const off = { up: [0, -2.5], down: [0, 2], left: [-3, 0], right: [3, 0] }[facing];
  ctx.fillStyle = C('plum');
  ctx.fillRect(Math.round(8 + (off[0] ?? 0)) - 1, Math.round(7 + (off[1] ?? 0)) - 1, 2, 2);
  tex.refresh();
}

/** Builds every texture in the sprite registry. Called once at boot. */
export function generateShapeTextures(scene: Phaser.Scene): void {
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  for (const [key, src] of Object.entries(SPRITES)) {
    if (src.kind !== 'shape') continue;
    if (key.startsWith('equip.')) {
      const defId = key.split('.')[1] ?? '';
      const def = EQUIPMENT[defId];
      if (!def) continue;
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const odd = rot % 2 === 1;
        const w = (odd ? def.h : def.w) * TILE_SIZE;
        const h = (odd ? def.w : def.h) * TILE_SIZE;
        drawEquipment(scene, variantKey(key, rot), src, w, h, rot);
      }
    } else if (key.startsWith('char.')) {
      for (const d of dirs) drawCharacter(scene, variantKey(key, d), src, d);
    }
  }
}
