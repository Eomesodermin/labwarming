import Phaser from 'phaser';
import { TICKS_PER_SECOND } from '../../content/balance';
import { tierStat } from '../../content/equipment';
import { PLOTS, TILE_SIZE } from '../../content/map';
import { footprintSize } from '../../sim/grid';
import { slotsOf } from '../../sim/systems/cultures';
import { wasteCapacity, plotOf } from '../../sim/stock';
import type { Culture, Equipment, GameState, Job } from '../../sim/types';
import { PALETTE } from '../art/palette';

const BAR_W = 22;
const BAR_H = 5;

/** The top-left pixel of a small gauge on the back side of a piece of equipment (the side with no front). */
function gaugeOrigin(eq: Equipment, w: number, h: number): { x: number; y: number } {
  const size = footprintSize(eq);
  const px = eq.x * TILE_SIZE;
  const py = eq.y * TILE_SIZE;
  const pw = size.w * TILE_SIZE;
  const ph = size.h * TILE_SIZE;
  switch (eq.rot) {
    case 0:
      return { x: px + Math.round((pw - w) / 2), y: py - h - 2 };
    case 2:
      return { x: px + Math.round((pw - w) / 2), y: py + ph + 2 };
    case 1:
      return { x: px + pw + 2, y: py + Math.round((ph - h) / 2) };
    default:
      return { x: px - w - 2, y: py + Math.round((ph - h) / 2) };
  }
}

/**
 * Progress bars over stations, culture dots on incubators, the bin gauge and warning marks.
 * One Graphics object, cleared and redrawn every frame. Draws from state only.
 */
export class StatusRenderer {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(5000);
  }

  sync(state: GameState, nowMs: number): void {
    const g = this.g;
    g.clear();
    for (const eq of Object.values(state.equipment)) {
      if (eq.defId === 'incubator') this.drawCultures(state, eq, nowMs);
      else if (eq.defId === 'bin') this.drawBinGauge(state, eq);
      else if (eq.defId === 'fridge' && eq.broken) this.drawWarning(eq, nowMs);
      else if (eq.defId === 'bay') this.drawBoxes(state, eq);
      else if (eq.defId === 'autoclave' && eq.broken) this.drawWarning(eq, nowMs);
      else if (eq.defId === 'autoclave' && eq.cycle) this.drawCycle(eq, eq.cycle.ticksLeft);
      if (eq.defId === 'autoclave' && eq.broken && eq.repairTicks) this.drawTimer(eq, eq.repairTicks, 300, PALETTE.teal);
      if (eq.defId === 'bench' && eq.outTicks) this.drawTimer(eq, eq.outTicks, 200, PALETTE.sky);
    }
    for (const b of state.lostBoxes) this.drawLostBox(b.x, b.y, nowMs);
    if (state.director.cake) this.drawCake(state.director.cake.x, state.director.cake.y, nowMs);
    if (state.flags['goldStar'] === true) this.drawStar(state);
    for (const job of Object.values(state.jobs)) {
      const eq = state.equipment[job.stationId];
      if (!eq || job.progressTicks <= 0) continue;
      const worker = state.agents[job.workerId];
      this.drawJobBar(eq, job, worker?.jobId === job.id);
    }
  }

  private drawJobBar(eq: Equipment, job: Job, active: boolean): void {
    const g = this.g;
    const { x, y } = gaugeOrigin(eq, BAR_W, BAR_H);
    const alpha = active ? 1 : 0.6;
    g.fillStyle(PALETTE.plum, alpha).fillRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2);
    g.fillStyle(PALETTE.cream, alpha).fillRect(x, y, BAR_W, BAR_H);
    // The green zone for the sweet-spot bonus.
    const zs = Math.round((job.sweetStart / job.totalTicks) * BAR_W);
    const ze = Math.round((job.sweetEnd / job.totalTicks) * BAR_W);
    if (job.sweetEnd > job.sweetStart) g.fillStyle(PALETTE.sage, alpha).fillRect(x + zs, y, Math.max(1, ze - zs), BAR_H);
    const fill = Math.round((job.progressTicks / job.totalTicks) * BAR_W);
    g.fillStyle(active ? PALETTE.terracotta : PALETTE.slate, alpha).fillRect(x, y + 1, fill, BAR_H - 2);
    // The marker runs along the bar once. It turns gold when the press was in the zone.
    const marker = job.sweetPressed ? (job.sweetHit ? PALETTE.mustard : PALETTE.stone) : PALETTE.paper;
    g.fillStyle(marker, alpha).fillRect(x + Math.min(BAR_W - 1, fill), y - 1, 1, BAR_H + 2);
  }

  private drawCultures(state: GameState, eq: Equipment, nowMs: number): void {
    const slots = slotsOf(eq);
    const mine = state.cultures.filter((c) => c.incubatorId === eq.id);
    const perRow = 4;
    const dot = 4;
    const rows = Math.ceil(slots / perRow);
    for (let i = 0; i < slots; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, slots - row * perRow);
      const x = eq.x * TILE_SIZE + Math.round((TILE_SIZE - (inRow * (dot + 1) - 1)) / 2) + col * (dot + 1);
      const y = eq.y * TILE_SIZE - 5 - (rows - 1 - row) * (dot + 1);
      const c = mine[i];
      this.drawDot(x, y, dot, c, nowMs, tierStat('incubator', 'growSec', eq.tier) * TICKS_PER_SECOND);
    }
  }

  private drawDot(x: number, y: number, size: number, c: Culture | undefined, nowMs: number, growTotal: number): void {
    const g = this.g;
    if (!c) {
      g.lineStyle(1, PALETTE.stone, 1).strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      return;
    }
    if (c.status === 'growing') {
      g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, size + 2, size + 2);
      g.fillStyle(PALETTE.cream, 1).fillRect(x, y, size, size);
      const frac = Math.min(1, Math.max(0, 1 - c.growTicksLeft / growTotal));
      g.fillStyle(PALETTE.sky, 1).fillRect(x, y + size - Math.max(1, Math.round(size * frac)), size, Math.max(1, Math.round(size * frac)));
    } else if (c.status === 'ready') {
      g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, size + 2, size + 2);
      g.fillStyle(PALETTE.butter, 1).fillRect(x, y, size, size);
      // A small twinkle above a ready culture.
      if (Math.floor(nowMs / 400) % 2 === 0) g.fillStyle(PALETTE.mustard, 1).fillRect(x + 1, y - 4, 2, 2);
    } else {
      g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, size + 2, size + 2);
      g.fillStyle(PALETTE.moss, 1).fillRect(x, y, size, size);
      g.fillStyle(PALETTE.sage, 1).fillRect(x - 1, y + 1, 1, 2).fillRect(x + size, y + 1, 1, 2).fillRect(x + 1, y - 2, 2, 1);
    }
  }

  /** The autoclave's cycle: a bar that fills while it runs unattended. A full gold bar means it waits for shelf room. */
  private drawCycle(eq: Equipment, ticksLeft: number): void {
    const total = Math.max(1, tierStat('autoclave', 'cycleSec', eq.tier) * TICKS_PER_SECOND);
    const w = 26;
    const h = 4;
    const { x, y } = gaugeOrigin(eq, w, h);
    const frac = Math.min(1, Math.max(0, 1 - ticksLeft / total));
    this.g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    this.g.fillStyle(PALETTE.cream, 1).fillRect(x, y, w, h);
    this.g.fillStyle(ticksLeft <= 0 ? PALETTE.mustard : PALETTE.teal, 1).fillRect(x, y, Math.max(1, Math.round(frac * w)), h);
  }

  private drawBinGauge(state: GameState, eq: Equipment): void {
    const plotId = plotOf(eq);
    if (!plotId) return;
    const waste = state.plots[plotId]?.waste ?? 0;
    if (waste <= 0) return;
    const cap = Math.max(1, wasteCapacity(state, plotId));
    const w = 14;
    const h = 3;
    const { x, y } = gaugeOrigin(eq, w, h);
    const full = waste >= cap;
    this.g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    this.g.fillStyle(PALETTE.cream, 1).fillRect(x, y, w, h);
    this.g.fillStyle(full ? PALETTE.berry : PALETTE.mustard, 1).fillRect(x, y, Math.round((Math.min(waste, cap) / cap) * w), h);
  }

  /** Delivered boxes wait on the bay, drawn as small cardboard squares. */
  private drawBoxes(state: GameState, eq: Equipment): void {
    const n = Math.min(state.boxes.length, 4);
    for (let i = 0; i < n; i++) {
      const x = eq.x * TILE_SIZE + 2 + (i % 2) * 6;
      const y = eq.y * TILE_SIZE + 2 + Math.floor(i / 2) * 6;
      this.g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, 7, 7);
      this.g.fillStyle(PALETTE.warmWood, 1).fillRect(x, y, 5, 5);
      this.g.fillStyle(PALETTE.cream, 1).fillRect(x + 2, y, 1, 5);
    }
  }

  /** A small countdown bar over a machine that is out of use: updates, or the engineer on the way. */
  private drawTimer(eq: Equipment, left: number, total: number, colour: number): void {
    const w = 22;
    const h = 4;
    const { x, y } = gaugeOrigin(eq, w, h);
    this.g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    this.g.fillStyle(PALETTE.cream, 1).fillRect(x, y, w, h);
    this.g.fillStyle(colour, 1).fillRect(x, y, Math.max(1, Math.round((1 - Math.min(1, left / total)) * w)), h);
  }

  /** A box in the corridor with a question mark bobbing over it. */
  private drawLostBox(tx: number, ty: number, nowMs: number): void {
    const g = this.g;
    const x = tx * TILE_SIZE + 3;
    const y = ty * TILE_SIZE + 5;
    g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, 12, 10);
    g.fillStyle(PALETTE.warmWood, 1).fillRect(x, y, 10, 8);
    g.fillStyle(PALETTE.cream, 1).fillRect(x + 4, y, 2, 8);
    const bob = Math.floor(nowMs / 350) % 2;
    const qx = x + 2;
    const qy = y - 11 - bob;
    g.fillStyle(PALETTE.plum, 1).fillRect(qx - 1, qy - 1, 8, 10);
    g.fillStyle(PALETTE.butter, 1).fillRect(qx, qy, 6, 8);
    g.fillStyle(PALETTE.plum, 1).fillRect(qx + 1, qy + 1, 4, 1).fillRect(qx + 4, qy + 2, 1, 2).fillRect(qx + 2, qy + 4, 2, 1).fillRect(qx + 2, qy + 6, 1, 1);
  }

  /** Quince's cake on the corridor floor: a plate, two layers and a candle that flickers. */
  private drawCake(tx: number, ty: number, nowMs: number): void {
    const g = this.g;
    const x = tx * TILE_SIZE + 2;
    const y = ty * TILE_SIZE + 6;
    g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, 14, 11);
    g.fillStyle(PALETTE.paper, 1).fillRect(x, y + 7, 12, 2);
    g.fillStyle(PALETTE.cocoa, 1).fillRect(x + 1, y + 3, 10, 4);
    g.fillStyle(PALETTE.dustyRose, 1).fillRect(x + 1, y, 10, 3);
    g.fillStyle(PALETTE.butter, 1).fillRect(x + 5, y - 4, 2, 4);
    if (Math.floor(nowMs / 250) % 2 === 0) g.fillStyle(PALETTE.mustard, 1).fillRect(x + 5, y - 6, 2, 2);
    else g.fillStyle(PALETTE.terracotta, 1).fillRect(x + 5, y - 5, 2, 1);
  }

  /** The gold star Tock puts on the lab door. */
  private drawStar(state: GameState): void {
    const g = this.g;
    for (const p of PLOTS) {
      if (state.plots[p.id]?.roomType !== 'lab' || !state.plots[p.id]?.owned) continue;
      const cx = p.door.x * TILE_SIZE + 8;
      const cy = p.door.y * TILE_SIZE + 3;
      g.fillStyle(PALETTE.plum, 1).fillRect(cx - 6, cy - 1, 12, 4).fillRect(cx - 2, cy - 5, 4, 12).fillRect(cx - 4, cy - 3, 8, 8);
      g.fillStyle(PALETTE.mustard, 1).fillRect(cx - 5, cy, 10, 2).fillRect(cx - 1, cy - 4, 2, 10).fillRect(cx - 3, cy - 2, 6, 6);
      g.fillStyle(PALETTE.butter, 1).fillRect(cx - 1, cy - 1, 2, 2);
    }
  }

  private drawWarning(eq: Equipment, nowMs: number): void {
    if (Math.floor(nowMs / 600) % 2 === 1) return;
    const x = eq.x * TILE_SIZE + TILE_SIZE - 5;
    const y = eq.y * TILE_SIZE - 3;
    this.g.fillStyle(PALETTE.plum, 1).fillRect(x - 1, y - 1, 6, 6);
    this.g.fillStyle(PALETTE.berry, 1).fillRect(x, y, 4, 4);
  }
}
