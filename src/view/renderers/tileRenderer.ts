import Phaser from 'phaser';
import { DELIVERY_BAY, MAP_H, MAP_W, PLOTS, TILE_SIZE, WASTE_POINT } from '../../content/map';
import { baseTile } from '../../sim/grid';
import type { GameState } from '../../sim/types';
import { PALETTE, PALETTE_HEX } from '../art/palette';

const T = TILE_SIZE;

/** Draws the floor plan: floors, walls, doors, the corridor and plots for sale. Redrawn when plots change. */
export class TileRenderer {
  private gfx: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private ownedKey = '';

  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(0);
  }

  sync(state: GameState): void {
    const key = Object.values(state.plots)
      .map((p) => `${p.id}${p.owned ? 1 : 0}`)
      .join('');
    if (key === this.ownedKey) return;
    this.ownedKey = key;
    this.draw(state);
  }

  private draw(state: GameState): void {
    const g = this.gfx;
    g.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];

    const wallAt = (x: number, y: number): boolean => baseTile(x, y).kind === 'wall';

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = baseTile(x, y);
        const px = x * T;
        const py = y * T;
        const owned = t.plotId !== null && state.plots[t.plotId]?.owned === true;
        switch (t.kind) {
          case 'outside':
            g.fillStyle(PALETTE.moss);
            g.fillRect(px, py, T, T);
            if ((x * 7 + y * 13) % 5 === 0) {
              g.fillStyle(PALETTE.sage);
              g.fillRect(px + 5, py + 6, 2, 2);
            }
            break;
          case 'wall':
            g.fillStyle(PALETTE.stone);
            g.fillRect(px, py, T, T);
            break;
          case 'floor':
            g.fillStyle(owned ? PALETTE.cream : PALETTE.stone);
            g.fillRect(px, py, T, T);
            if (owned) {
              g.lineStyle(1, PALETTE.butter, 0.5);
              g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
            }
            break;
          case 'corridor':
            g.fillStyle(PALETTE.stone);
            g.fillRect(px, py, T, T);
            g.lineStyle(1, PALETTE.slate, 0.25);
            g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
            break;
          case 'entrance':
            g.fillStyle(PALETTE.butter);
            g.fillRect(px, py, T, T);
            g.lineStyle(1, PALETTE.mustard, 1);
            g.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3);
            break;
          case 'door':
            // An open door is a gap in the wall. A closed door is a wooden panel.
            g.fillStyle(owned ? PALETTE.butter : PALETTE.cocoa);
            g.fillRect(px, py, T, T);
            g.lineStyle(1, PALETTE.plum, 1);
            if (!owned) g.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3);
            break;
        }
      }
    }

    // Wall outlines: a plum line wherever a wall meets something that is not wall.
    g.lineStyle(1, PALETTE.plum, 1);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!wallAt(x, y)) continue;
        const px = x * T;
        const py = y * T;
        const edge = (nx: number, ny: number): boolean => {
          const k = baseTile(nx, ny).kind;
          return k !== 'wall' && k !== 'outside';
        };
        if (edge(x, y - 1)) g.lineBetween(px, py + 0.5, px + T, py + 0.5);
        if (edge(x, y + 1)) g.lineBetween(px, py + T - 0.5, px + T, py + T - 0.5);
        if (edge(x - 1, y)) g.lineBetween(px + 0.5, py, px + 0.5, py + T);
        if (edge(x + 1, y)) g.lineBetween(px + T - 0.5, py, px + T - 0.5, py + T);
        // Outer edge against the grass.
        const out = (nx: number, ny: number): boolean => baseTile(nx, ny).kind === 'outside';
        if (out(x, y - 1)) g.lineBetween(px, py + 0.5, px + T, py + 0.5);
        if (out(x, y + 1)) g.lineBetween(px, py + T - 0.5, px + T, py + T - 0.5);
        if (out(x - 1, y)) g.lineBetween(px + 0.5, py, px + 0.5, py + T);
        if (out(x + 1, y)) g.lineBetween(px + T - 0.5, py, px + T - 0.5, py + T);
      }
    }

    // Plots for sale: a darker overlay with a sign.
    for (const def of PLOTS) {
      if (state.plots[def.id]?.owned) continue;
      g.fillStyle(PALETTE.slate, 0.18);
      g.fillRect(def.x * T, def.y * T, def.w * T, def.h * T);
      g.lineStyle(1, PALETTE.slate, 0.8);
      g.strokeRect(def.x * T + 4.5, def.y * T + 4.5, def.w * T - 9, def.h * T - 9);
      const cx = (def.x + def.w / 2) * T;
      const cy = (def.y + def.h / 2) * T;
      this.labels.push(this.text(cx, cy - 4, 'FOR SALE', PALETTE_HEX.plum, 8));
      this.labels.push(this.text(cx, cy + 6, `Plot ${def.id.toUpperCase()}`, PALETTE_HEX.plum, 6));
    }

    // Delivery bay and waste point markers.
    this.marker(DELIVERY_BAY.x, DELIVERY_BAY.y, PALETTE.mustard, 'IN');
    this.marker(WASTE_POINT.x, WASTE_POINT.y, PALETTE.berry, 'OUT');
  }

  private marker(x: number, y: number, colour: number, label: string): void {
    const g = this.gfx;
    g.lineStyle(1, colour, 1);
    g.strokeRect(x * T + 1.5, y * T + 1.5, T - 3, T - 3);
    this.labels.push(this.text(x * T + T / 2, y * T + T / 2, label, PALETTE_HEX.plum, 5));
  }

  private text(x: number, y: number, s: string, colour: string, size: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color: colour })
      .setOrigin(0.5)
      .setDepth(1);
  }
}
