import Phaser from 'phaser';
import { EQUIPMENT } from '../../content/equipment';
import { MAP_H, MAP_W, PLOTS, TILE_SIZE } from '../../content/map';
import { ROOMS } from '../../content/rooms';
import type { BuildUi, WorldUi } from '../../host';
import { footprintTiles, frontTiles } from '../../sim/grid';
import { insideDoorTile, pathWarnings } from '../../sim/placement';
import type { Equipment, GameState } from '../../sim/types';
import { PALETTE } from '../art/palette';
import { IconPool } from './iconPool';

const T = TILE_SIZE;

/** The build mode overlay: the tile grid, keep-clear marks, room names, the ghost and warnings. */
export class BuildRenderer {
  private g: Phaser.GameObjects.Graphics;
  private icons: IconPool;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(4000);
    this.icons = new IconPool(scene, 4002);
  }

  sync(state: GameState, build: BuildUi, nowMs: number, cam: Phaser.Cameras.Scene2D.Camera, world: WorldUi): void {
    const g = this.g;
    g.clear();
    this.icons.begin();
    world.labels = build.active ? this.roomLabels(state, cam) : [];
    if (!build.active) {
      this.icons.end();
      return;
    }

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
    const pulse = 0.35 + 0.25 * Math.sin(nowMs / 220);
    for (const w of pathWarnings(state)) {
      const eq = state.equipment[w.equipmentId];
      if (!eq) continue;
      this.icons.put('icon.exclaim', eq.x * T + 8, eq.y * T + 8);
      for (const t of footprintTiles(eq)) g.fillStyle(PALETTE.berry, pulse).fillRect(t.x * T, t.y * T, T, T);
      this.outline(eq, PALETTE.berry, 2);
    }

    // The ghost.
    if (build.held && build.hover) this.drawGhost(build);
    this.icons.end();
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

  /** Room names at the top left of each built room, as game-pixel positions for the ui to draw. */
  private roomLabels(state: GameState, cam: Phaser.Cameras.Scene2D.Camera): WorldUi['labels'] {
    const out: WorldUi['labels'] = [];
    for (const def of PLOTS) {
      const plot = state.plots[def.id];
      if (!plot?.owned || !plot.roomType) continue;
      out.push({
        text: ROOMS[plot.roomType].name,
        gx: (def.x * T + 3 - cam.worldView.x) * cam.zoom,
        gy: (def.y * T + 2 - cam.worldView.y) * cam.zoom,
      });
    }
    return out;
  }
}
