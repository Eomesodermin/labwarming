import type { Rot } from '../../sim/types';
import { PALETTE_HEX, type PaletteName } from './palette';

/** One letter per palette colour. A sprite grid can only use these letters and '.', so it can only use the 16 colours. */
export const LEGEND: Record<string, PaletteName> = {
  p: 'plum',
  c: 'cocoa',
  w: 'warmWood',
  t: 'terracotta',
  m: 'mustard',
  b: 'butter',
  r: 'cream',
  q: 'paper',
  s: 'sage',
  o: 'moss',
  e: 'teal',
  k: 'sky',
  d: 'dustyRose',
  y: 'berry',
  n: 'stone',
  l: 'slate',
};

/** Replaces one letter with another before painting (a recolour). */
export type Swap = Readonly<Record<string, string>>;

export function gridSize(rows: readonly string[]): { w: number; h: number } {
  return { w: rows[0]?.length ?? 0, h: rows.length };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Paints a grid onto a new canvas, one pixel per letter. */
export function gridToCanvas(rows: readonly string[], swap?: Swap): HTMLCanvasElement {
  const { w, h } = gridSize(rows);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const raw = row[x] ?? '.';
      if (raw === '.') continue;
      const name = LEGEND[swap?.[raw] ?? raw];
      if (!name) continue;
      ctx.fillStyle = PALETTE_HEX[name];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

/** Turns a canvas 90 degrees at a time, clockwise, with no smoothing. */
export function turnCanvas(src: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const q = ((quarterTurns % 4) + 4) % 4;
  if (q === 0) return src;
  const odd = q % 2 === 1;
  const out = makeCanvas(odd ? src.height : src.width, odd ? src.width : src.height);
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

export function flipCanvasX(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return out;
}

/** Quarter turns for an equipment rotation. Art is drawn with its front facing down. */
export const ROT_TURNS: Record<Rot, number> = { 0: 0, 1: 1, 2: 0, 3: 3 };

/** A canvas as a data URL, for HTML images. */
export function canvasUrl(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

export function newCanvas(w: number, h: number): HTMLCanvasElement {
  return makeCanvas(w, h);
}
