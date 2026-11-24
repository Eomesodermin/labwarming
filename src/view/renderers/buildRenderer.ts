import Phaser from 'phaser';
import { EQUIPMENT } from '../../content/equipment';
import { MAP_H, MAP_W, PLOTS, TILE_SIZE } from '../../content/map';
import { ROOMS } from '../../content/rooms';
import type { BuildUi } from '../../host';
import { footprintTiles, frontTiles } from '../../sim/grid';
import { insideDoorTile, pathWarnings } from '../../sim/placement';
import type { Equipment, GameState } from '../../sim/types';
import { PALETTE, PALETTE_HEX } from '../art/palette';

const T = TILE_SIZE;

/** The build mode overlay: the tile grid, keep-clear marks, room names, the ghost and warnings. */
export class BuildRenderer {
  private g: Phaser.GameObjects.Graphics;
  private names = new Map<string, Phaser.GameObjects.Text>();
  private warn = new Map<string, Phaser.GameObjects.Text>();

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(4000);
  }

  sync(state: GameState, build: BuildUi, nowMs: number): void {
    const g = this.g;
    g.clear();
    this.showTexts(state, build.active);
    if (!build.active) return;

    // The grid, over the whole map.
    g.lineStyle(1, PALETTE.plum, 0.18);
    for (let x = 0; x <= MAP_W; x++) g.lineBetween(x * T + 0.5, 0, x * T + 0.5, MAP_H * T);
    for (let y = 0; y <= MAP_H; y++) g.lineBetween(0, y * T + 0.5, MAP_W * T, y * T + 0.5);

    // Door tiles and the tile inside each door stay clear.
    for (const def of PLOTS) {
      if (!state.plots[def.id]?.owned) continue;
      const inside = insideDoorTile(def);
      for (const t of [inside, def.door]) {
        g.fillStyle(PALETTE.mustard, 0.35).fillRect(t.x * T, t.y * T, T, T);
        g.lineStyle(1, PALETTE.mustard, 1).strokeRect(t.x * T + 1.5, t.y * T + 1.5, T - 3, T - 3);
      }
    }

    // Plots for sale: hover and selection.
    for (const def of PLOTS) {
      if (state.plots[def.id]?.owned) continue;
      const selected = build.selectedPlot === def.id;
      const hovered = !build.held && build.hover !== null && this.inPlot(def.id, build.hover.x, build.hover.y);
      if (selected || hovered) {
        g.fillStyle(PALETTE.mustard, selected ? 0.3 : 0.18).fillRect(def.x * T, def.y * T, def.w * T, def.h * T);
        g.lineStyle(2, PALETTE.mustard, 1).strokeRect(def.x * T + 1, def.y * T + 1, def.w * T - 2, def.h * T - 2);
      }
    }

    // The selected piece.
    const sel = build.selectedEquipment ? state.equipment[build.selectedEquipment] : undefined;
    if (sel) this.outline(sel, PALETTE.mustard, 2);

    // Equipment that nobody can walk up to.
    const warned = new Set<string>();
    const pulse = 0.35 + 0.25 * Math.sin(nowMs / 220);
    for (const w of pathWarnings(state)) {
      const eq = state.equipment[w.equipmentId];
      if (!eq) continue;
      warned.add(eq.id);
      for (const t of footprintTiles(eq)) g.fillStyle(PALETTE.berry, pulse).fillRect(t.x * T, t.y * T, T, T);
      this.outline(eq, PALETTE.berry, 2);
    }
    this.syncWarnTexts(state, warned);

    // The ghost.
    if (build.held && build.hover) this.drawGhost(build);
  }

  private inPlot(plotId: string, x: number, y: number): boolean {
    const def = PLOTS.find((p) => p.id === plotId);
    return !!def && x >= def.x && x < def.x + def.w && y >= def.y && y < def.y + def.h;
  }

  private outline(eq: Equipment, colour: number, width: number): void {
    const tiles = footprintTiles(eq);
    const minX = Math.min(...tiles.map((t) => t.x));
    const minY = Math.min(...tiles.map((t) => t.y));
    const maxX = Math.max(...tiles.map((t) => t.x)) + 1;
    const maxY = Math.max(...tiles.map((t) => t.y)) + 1;
    this.g.lineStyle(width, colour, 1).strokeRect(minX * T + 0.5, minY * T + 0.5, (maxX - minX) * T - 1, (maxY - minY) * T - 1);
  }

  private drawGhost(build: BuildUi): void {
    const held = build.held;
    const hover = build.hover;
    if (!held || !hover) return;
    const def = EQUIPMENT[held.defId];
    if (!def) return;
    const probe: Equipment = { id: '_ghost', defId: held.defId, tier: 1, x: hover.x, y: hover.y, rot: held.rot, broken: false, cycle: null };
    const colour = build.valid ? PALETTE.sage : PALETTE.berry;
    const g = this.g;
    for (const t of footprintTiles(probe)) {
      g.fillStyle(colour, 0.65).fillRect(t.x * T, t.y * T, T, T);
    }
    this.outline(probe, build.valid ? PALETTE.moss : PALETTE.berry, 2);
    // The use tile in front, so the player can see where they would stand.
    for (const f of frontTiles(probe)) {
      g.lineStyle(1, PALETTE.mustard, 1).strokeRect(f.x * T + 2.5, f.y * T + 2.5, T - 5, T - 5);
      g.fillStyle(PALETTE.mustard, 0.35).fillRect(f.x * T + 2, f.y * T + 2, T - 4, T - 4);
    }
  }

  private showTexts(state: GameState, on: boolean): void {
    for (const def of PLOTS) {
      const plot = state.plots[def.id];
      let t = this.names.get(def.id);
      if (!t) {
        t = this.text(0, 0, '', PALETTE_HEX.plum, 6);
        t.setOrigin(0, 0).setDepth(4001);
        this.names.set(def.id, t);
      }
      t.setPosition(def.x * T + 2, def.y * T + 1);
      t.setText(plot?.owned && plot.roomType ? ROOMS[plot.roomType].name.toUpperCase() : '');
      t.setVisible(on && !!plot?.owned);
    }
    if (!on) for (const t of this.warn.values()) t.setVisible(false);
  }

  private syncWarnTexts(state: GameState, warned: Set<string>): void {
    for (const [id, t] of this.warn) {
      if (!warned.has(id) || !state.equipment[id]) {
        t.destroy();
        this.warn.delete(id);
      }
    }
    for (const id of warned) {
      const eq = state.equipment[id];
      if (!eq) continue;
      let t = this.warn.get(id);
      if (!t) {
        t = this.text(0, 0, '!', PALETTE_HEX.paper, 9);
        t.setDepth(4002).setBackgroundColor(PALETTE_HEX.berry).setPadding(2, 0, 2, 0);
        this.warn.set(id, t);
      }
      t.setVisible(true);
      t.setPosition(eq.x * T + 2, eq.y * T - 1);
    }
  }

  private text(x: number, y: number, s: string, colour: string, size: number): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color: colour });
  }
}
