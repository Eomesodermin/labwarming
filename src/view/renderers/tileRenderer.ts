import Phaser from 'phaser';
import { MAP_H, MAP_W, PLOTS, TILE_SIZE, WASTE_POINT } from '../../content/map';
import { ROOMS } from '../../content/rooms';
import { baseTile } from '../../sim/grid';
import type { GameState } from '../../sim/types';
import { PALETTE_HEX } from '../art/palette';
import { floorCanvas, numberCanvas, spriteCanvas } from '../art/spriteRegistry';

const T = TILE_SIZE;
const TEX = 'world.tiles';

/** What a plot costs at the least: the cheapest room that can be built. Shown on the sign. */
function cheapestRoom(): number {
  return Math.min(...Object.values(ROOMS).filter((r) => r.available).map((r) => r.cost));
}

/**
 * Paints the floor plan once into a single canvas texture: floors, walls, doors, the corridor and
 * the plots for sale. Repainted only when a plot changes. No text: the signs use a pixel font.
 */
export class TileRenderer {
  private tex: Phaser.Textures.CanvasTexture;
  private ownedKey = '';

  constructor(scene: Phaser.Scene) {
    this.tex = scene.textures.createCanvas(TEX, MAP_W * T, MAP_H * T) as Phaser.Textures.CanvasTexture;
    scene.add.image(0, 0, TEX).setOrigin(0, 0).setDepth(0);
  }

  sync(state: GameState): void {
    const key = Object.values(state.plots)
      .map((p) => `${p.id}${p.owned ? 1 : 0}${p.roomType ?? ''}`)
      .join('');
    if (key === this.ownedKey) return;
    this.ownedKey = key;
    this.draw(state);
  }

  private draw(state: GameState): void {
    const ctx = this.tex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, MAP_W * T, MAP_H * T);
    const put = (c: HTMLCanvasElement, x: number, y: number): void => {
      ctx.drawImage(c, x * T, y * T);
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = baseTile(x, y);
        const owned = t.plotId !== null && state.plots[t.plotId]?.owned === true;
        switch (t.kind) {
          case 'outside':
            put(spriteCanvas((x * 7 + y * 13) % 3 === 0 ? 'tile.grass2' : 'tile.grass1'), x, y);
            break;
          case 'wall': {
            const below = baseTile(x, y + 1).kind;
            put(spriteCanvas(below !== 'wall' && below !== 'outside' ? 'tile.wallface' : 'tile.walltop'), x, y);
            break;
          }
          case 'floor':
            put(owned ? floorCanvas(state.plots[t.plotId ?? '']?.roomType ?? null) : spriteCanvas('tile.lot'), x, y);
            break;
          case 'corridor':
            put(spriteCanvas('tile.corridor'), x, y);
            break;
          case 'entrance':
            put(spriteCanvas('tile.entrance'), x, y);
            break;
          case 'door':
            put(spriteCanvas(owned ? 'tile.dooropen' : 'tile.doorclosed'), x, y);
            break;
        }
      }
    }
    put(spriteCanvas('tile.wastepoint'), WASTE_POINT.x, WASTE_POINT.y);

    // Wall outlines: a plum line wherever a wall meets something that is not wall.
    ctx.fillStyle = PALETTE_HEX.plum;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (baseTile(x, y).kind !== 'wall') continue;
        const open = (nx: number, ny: number): boolean => baseTile(nx, ny).kind !== 'wall';
        if (open(x, y - 1)) ctx.fillRect(x * T, y * T, T, 1);
        if (open(x, y + 1)) ctx.fillRect(x * T, y * T + T - 1, T, 1);
        if (open(x - 1, y)) ctx.fillRect(x * T, y * T, 1, T);
        if (open(x + 1, y)) ctx.fillRect(x * T + T - 1, y * T, 1, T);
      }
    }

    // Plots for sale: a dashed outline and a small sign with the price.
    const price = cheapestRoom();
    for (const def of PLOTS) {
      if (state.plots[def.id]?.owned) continue;
      this.dashedBox(ctx, def.x * T + 3, def.y * T + 3, def.w * T - 6, def.h * T - 6);
      this.sign(ctx, (def.x + def.w / 2) * T, (def.y + def.h / 2) * T, price);
    }
    this.tex.refresh();
  }

  /** A one pixel dashed rectangle in paper, with a plum dash under it so it shows on any ground. */
  private dashedBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const dash = (px: number, py: number, horizontal: boolean, i: number): void => {
      if (Math.floor(i / 3) % 2 !== 0) return;
      ctx.fillStyle = PALETTE_HEX.plum;
      ctx.fillRect(px + (horizontal ? 0 : 1), py + (horizontal ? 1 : 0), 1, 1);
      ctx.fillStyle = PALETTE_HEX.paper;
      ctx.fillRect(px, py, 1, 1);
    };
    for (let i = 0; i < w; i++) {
      dash(x + i, y, true, i);
      dash(x + i, y + h - 1, true, i);
    }
    for (let j = 0; j < h; j++) {
      dash(x, y + j, false, j);
      dash(x + w - 1, y + j, false, j);
    }
  }

  /** A little wooden sign on a post: a coin and the price. */
  private sign(ctx: CanvasRenderingContext2D, cx: number, cy: number, price: number): void {
    const digits = numberCanvas(price, 'p');
    const coin = spriteCanvas('icon.coin');
    const w = coin.width + 2 + digits.width + 6;
    const h = 11;
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2) - 3;
    ctx.fillStyle = PALETTE_HEX.cocoa;
    ctx.fillRect(Math.round(cx) - 1, y + h, 3, 5);
    ctx.fillStyle = PALETTE_HEX.plum;
    ctx.fillRect(Math.round(cx) - 2, y + h + 4, 5, 1);
    ctx.fillStyle = PALETTE_HEX.plum;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE_HEX.butter;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PALETTE_HEX.mustard;
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.drawImage(coin, x + 3, y + 3);
    ctx.drawImage(digits, x + 3 + coin.width + 2, y + 3);
  }
}
