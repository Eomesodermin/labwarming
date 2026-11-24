import { EQUIPMENT } from '../../content/equipment';
import { TILE_SIZE } from '../../content/map';
import { ROOMS } from '../../content/rooms';
import type { StaffRole, PortraitColour } from '../../content/staff';
import type { AgentKind, Dir, Equipment, Rot, RoomTypeId } from '../../sim/types';
import { flipCanvasX, gridToCanvas, newCanvas, ROT_TURNS, turnCanvas, type Swap } from './pixelmap';
import { CHAR_BASE, CHAR_OVERLAYS } from './sprites/characters';
import { EQUIPMENT_ART, EQUIPMENT_STATES } from './sprites/equipment';
import { DIGIT_ART, ICON_ART } from './sprites/icons';
import { TILE_ART } from './sprites/tiles';

/**
 * The single place that says where each sprite comes from (design doc 7.4). Today every sprite is a
 * `pixelmap`: a text grid painted onto a canvas at boot. A `file` source would replace a key later
 * with no change to game code, because the renderers only ever ask this module for canvases.
 */
export type SpriteSource = { kind: 'pixelmap'; rows: readonly string[]; swap?: Swap };

export const SPRITES: Record<string, SpriteSource> = {};
for (const [id, rows] of Object.entries(EQUIPMENT_ART)) SPRITES[`equip.${id}`] = { kind: 'pixelmap', rows };
for (const [id, rows] of Object.entries(EQUIPMENT_STATES)) SPRITES[`equip.${id}`] = { kind: 'pixelmap', rows };
for (const [id, rows] of Object.entries(ICON_ART)) SPRITES[`icon.${id}`] = { kind: 'pixelmap', rows };
for (const [id, rows] of Object.entries(TILE_ART)) SPRITES[`tile.${id}`] = { kind: 'pixelmap', rows };
for (const [id, rows] of Object.entries(DIGIT_ART)) SPRITES[`digit.${id}`] = { kind: 'pixelmap', rows };

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}

/** The canvas for a plain registry key such as `icon.cake` or `tile.grass1`. */
export function spriteCanvas(key: string, swap?: Swap): HTMLCanvasElement {
  const src = SPRITES[key];
  if (!src) throw new Error(`No sprite called ${key}`);
  const tag = swap ? `${key}|${Object.entries(swap).join(',')}` : key;
  return cached(tag, () => gridToCanvas(src.rows, { ...src.swap, ...swap }));
}

// Tiles ---------------------------------------------------------------------------------------

/** Floor colours per room: base, grout line and speckle. */
const FLOOR_SWAPS: Record<string, Swap> = {
  cream: { '1': 'r', '2': 'b', '3': 'b' },
  sky: { '1': 'k', '2': 'q', '3': 'q' },
  butter: { '1': 'b', '2': 'r', '3': 'm' },
  paper: { '1': 'q', '2': 'r', '3': 'r' },
  sage: { '1': 's', '2': 'o', '3': 'o' },
};

export function floorCanvas(room: RoomTypeId | null): HTMLCanvasElement {
  const colour = room ? ROOMS[room].floor : 'cream';
  return spriteCanvas('tile.floor', FLOOR_SWAPS[colour] ?? FLOOR_SWAPS['cream']);
}

// Equipment -----------------------------------------------------------------------------------

export type EquipState = 'ok' | 'broken' | 'full';

/** Dulls the white and glass of a broken machine. */
const BROKEN_SWAP: Swap = { q: 'n', k: 'l', m: 'n' };

export function equipState(eq: Pick<Equipment, 'defId' | 'broken'>, binFull: boolean): EquipState {
  if (eq.broken && (eq.defId === 'fridge' || eq.defId === 'autoclave')) return 'broken';
  if (eq.defId === 'bin' && binFull) return 'full';
  return 'ok';
}

/** The registry key for a piece of equipment in a state. A state with no art of its own falls back to the plain sprite. */
function equipKey(defId: string, state: EquipState): string {
  if (state === 'full' && SPRITES[`equip.${defId}.full`]) return `equip.${defId}.full`;
  if (state === 'broken' && SPRITES[`equip.${defId}.broken`]) return `equip.${defId}.broken`;
  return SPRITES[`equip.${defId}`] ? `equip.${defId}` : 'equip.bench';
}

/** Marks the front of a piece with a mustard light, so you can tell which side to stand on after it has been turned. */
function markFront(c: HTMLCanvasElement, facing: Dir): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const opaque = (x: number, y: number): boolean => (data[(y * c.width + x) * 4 + 3] ?? 0) > 0;
  ctx.fillStyle = '#E8B04A';
  if (facing === 'up') {
    const cx = Math.floor(c.width / 2) - 1;
    for (let y = 0; y < c.height; y++) if (opaque(cx, y)) return void ctx.fillRect(cx, y, 2, 1);
  } else if (facing === 'left') {
    const cy = Math.floor(c.height / 2) - 1;
    for (let x = 0; x < c.width; x++) if (opaque(x, cy)) return void ctx.fillRect(x, cy, 1, 2);
  } else if (facing === 'right') {
    const cy = Math.floor(c.height / 2) - 1;
    for (let x = c.width - 1; x >= 0; x--) if (opaque(x, cy)) return void ctx.fillRect(x, cy, 1, 2);
  }
}

const ROT_FACING: Record<Rot, Dir> = { 0: 'down', 1: 'left', 2: 'up', 3: 'right' };

/** Equipment at a tier, state and rotation. Tiers add mustard pips; turned pieces get a front light. */
export function equipmentCanvas(defId: string, tier: number, rot: Rot, state: EquipState): HTMLCanvasElement {
  const id = `${defId}|${tier}|${rot}|${state}`;
  return cached(`eq:${id}`, () => {
    const key = equipKey(defId, state);
    const src = SPRITES[key] as SpriteSource;
    const swap = state === 'broken' && !SPRITES[`equip.${defId}.broken`] ? BROKEN_SWAP : undefined;
    const base = gridToCanvas(src.rows, swap);
    const ctx = base.getContext('2d');
    if (ctx && tier > 1) {
      // One pip for tier 2, two for tier 3, on the bottom right of the front.
      const pips = Math.min(tier - 1, 3);
      for (let i = 0; i < pips; i++) {
        const x = base.width - 6 - i * 3;
        const y = base.height - 5;
        ctx.fillStyle = '#4A3540';
        ctx.fillRect(x - 1, y - 1, 4, 4);
        ctx.fillStyle = '#E8B04A';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    const out = turnCanvas(base, ROT_TURNS[rot]);
    const result = out === base ? base : out;
    if (rot !== 0) markFront(result, ROT_FACING[rot]);
    return result;
  });
}

/** How big a piece of equipment is on screen at a rotation (always a whole number of tiles). */
export function equipmentPixelSize(defId: string, rot: Rot): { w: number; h: number } {
  const def = EQUIPMENT[defId];
  const w = (def?.w ?? 1) * TILE_SIZE;
  const h = (def?.h ?? 1) * TILE_SIZE;
  return rot % 2 === 1 ? { w: h, h: w } : { w, h };
}

// Characters ----------------------------------------------------------------------------------

type Slot = 'H' | 'h' | 'S' | 'W' | 'U' | 'V' | 'A' | 'T' | 'L' | 'F' | 'G';

export interface CharLook {
  slots: Record<Slot, string>;
  overlays: readonly string[];
}

const COLOUR_LETTER: Record<PortraitColour, string> = {
  terracotta: 't',
  mustard: 'm',
  sage: 's',
  teal: 'e',
  sky: 'k',
  dustyRose: 'd',
  berry: 'y',
  butter: 'b',
};

const SKINS = ['b', 'w', 'c'] as const;
/** Hair for each skin: [hair, highlight]. Dark skin gets dark hair so the outline still reads. */
const HAIRS: Record<string, ReadonlyArray<readonly [string, string]>> = {
  b: [['c', 'w'], ['p', 'l'], ['m', 'b'], ['t', 'w']],
  w: [['c', 'w'], ['p', 'l'], ['m', 'b']],
  c: [['p', 'l'], ['l', 'n']],
};

interface Base {
  U: string;
  V: string;
  L: string;
  F: string;
  W?: string;
  overlays: readonly string[];
}

const STAFF_BASES: Record<StaffRole, Base> = {
  technician: { U: 'y', V: 'p', L: 'l', F: 'p', overlays: ['glasses'] },
  washup: { U: 'e', V: 'l', L: 'l', F: 'p', W: 'k', overlays: ['band', 'apron'] },
  cleaner: { U: 's', V: 'o', L: 'o', F: 'p', overlays: ['cap'] },
  mediatech: { U: 'o', V: 'e', L: 'l', F: 'p', W: 'd', overlays: ['goggles'] },
};

/** The look of one character. `seed` varies skin, hair and the visitors' two looks. */
export function characterLook(kind: AgentKind, colour: PortraitColour | null, seed: number): CharLook {
  const skin = SKINS[seed % SKINS.length] as string;
  const hairs = HAIRS[skin] ?? (HAIRS['b'] as ReadonlyArray<readonly [string, string]>);
  const [hair, high] = hairs[Math.floor(seed / 3) % hairs.length] as readonly [string, string];
  const accent = colour ? COLOUR_LETTER[colour] : 't';
  const mk = (b: Base, o: Partial<Record<Slot, string>> = {}): CharLook => ({
    slots: { H: hair, h: high, S: skin, W: b.W ?? skin, U: b.U, V: b.V, A: accent, T: accent, L: b.L, F: b.F, G: 'l', ...o },
    overlays: b.overlays,
  });
  switch (kind) {
    case 'player':
      return mk({ U: 'q', V: 'n', L: 'e', F: 'c', overlays: ['ponytail', 'scarf'] }, { H: 'c', h: 'w', S: 'b', W: 'b', A: 't', T: 't' });
    case 'technician':
    case 'washup':
    case 'cleaner':
    case 'mediatech':
      return mk(STAFF_BASES[kind]);
    case 'pi':
      return mk({ U: 'c', V: 'p', L: 'l', F: 'p', overlays: ['glasses', 'scarf'] }, { H: 'q', h: 'n', S: 'b', W: 'b', A: 't' });
    case 'inspector':
      return mk({ U: 'l', V: 'p', L: 'p', F: 'p', overlays: ['brim'] }, { H: 'l', h: 'n', S: 'w', W: 'w', A: 'y', T: 'c' });
    case 'courier':
      return mk({ U: 'm', V: 'w', L: 'c', F: 'p', overlays: ['cap'] }, { H: 'c', h: 'w', S: 'w', W: 'w', A: 't', T: 't' });
    case 'visitor':
      return seed % 2 === 0
        ? mk({ U: 'd', V: 'y', L: 'l', F: 'c', overlays: ['ponytail'] }, { H: 'c', h: 'w', S: 'b', W: 'b', A: 'q' })
        : mk({ U: 'k', V: 'e', L: 'c', F: 'p', overlays: ['scarf'] }, { H: 'm', h: 'b', S: 'w', W: 'w', A: 'm' });
    default:
      return mk({ U: 't', V: 'c', L: 'l', F: 'p', overlays: [] });
  }
}

export type CharFrame = 'stand' | 'A' | 'B' | 'work';

/** One frame of a character, facing a direction. Left is the right-facing art mirrored. */
export function characterCanvas(look: CharLook, dir: Dir, frame: CharFrame): HTMLCanvasElement {
  const tag = `${Object.values(look.slots).join('')}|${look.overlays.join(',')}|${dir}|${frame}`;
  return cached(`ch:${tag}`, () => {
    const view = dir === 'left' || dir === 'right' ? 'side' : dir;
    const f = view === 'side' && frame === 'B' ? 'stand' : frame;
    const base = CHAR_BASE[`${view}.${f}`] ?? (CHAR_BASE[`${view}.stand`] as readonly string[]);
    const g = base.map((r) => r.split(''));
    for (const name of look.overlays) {
      const ov = CHAR_OVERLAYS[name]?.[view];
      if (!ov) continue;
      ov.rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i] as string;
          if (ch !== '.' && g[ov.y + j]) (g[ov.y + j] as string[])[i] = ch;
        }
      });
    }
    const rows = g.map((r) => r.map((ch) => look.slots[ch as Slot] ?? ch).join(''));
    // A dithered shadow under the feet, in plum so it stays inside the palette.
    let shadow = '';
    for (let i = 0; i < 16; i++) shadow += i >= 3 && i <= 12 && i % 2 === 0 ? 'p' : '.';
    rows[rows.length - 1] = shadow;
    const canvas = gridToCanvas(rows);
    return dir === 'left' ? flipCanvasX(canvas) : canvas;
  });
}

/** A standing, front-facing portrait of someone, for HTML (the party photo, the staff list). */
export function portraitCanvas(kind: AgentKind, colour: PortraitColour | null, seed: number): HTMLCanvasElement {
  return characterCanvas(characterLook(kind, colour, seed), 'down', 'stand');
}

// Small drawing helpers -----------------------------------------------------------------------

/** Draws a number with the 3 by 5 font. Returns a canvas, `colour` is a palette letter. */
export function numberCanvas(n: number, colour = 'p'): HTMLCanvasElement {
  const digits = String(Math.max(0, Math.floor(n))).split('');
  const c = newCanvas(digits.length * 4 - 1, 5);
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  digits.forEach((d, i) => ctx.drawImage(spriteCanvas(`digit.${d}`, { p: colour }), i * 4, 0));
  return c;
}

/** A stable small number from text, so a given agent always gets the same look. */
export function hashText(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
