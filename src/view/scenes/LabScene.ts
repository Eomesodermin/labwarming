import Phaser from 'phaser';
import { TICK_MS } from '../../content/balance';
import { MAP_H, MAP_W, PLOTS, TILE_SIZE } from '../../content/map';
import type { GameHost } from '../../host';
import { PLAYER_ID, type Command } from '../../sim/commands';
import { EQUIPMENT } from '../../content/equipment';
import { equipmentAt, inBounds, isWalkable } from '../../sim/grid';
import { spendBlocker } from '../../sim/funds';
import { placementBlocker } from '../../sim/placement';
import { plotOf } from '../../sim/stock';
import { facedMenu, stationPrompt } from '../../sim/selectors';
import { step } from '../../sim/step';
import { PALETTE } from '../art/palette';
import { createWalkInput, type WalkInput } from '../input/walkInput';
import { AgentRenderer, agentWorldPos } from '../renderers/agentRenderer';
import { BuildRenderer } from '../renderers/buildRenderer';
import { EquipmentRenderer } from '../renderers/equipmentRenderer';
import { StatusRenderer } from '../renderers/statusRenderer';
import { TileRenderer } from '../renderers/tileRenderer';

export const VIEW_W = 480;
export const VIEW_H = 270;
const MAX_TICKS_PER_FRAME = 5;
const MAX_FRAME_MS = 500;
/** Build mode zooms out so the whole map sits left of the side panel and below the top bars. */
const BUILD_ZOOM = 0.75;
const BUILD_TOP = 24;

/** Draws the lab from GameState each frame and drives the sim at a fixed tick rate. */
export class LabScene extends Phaser.Scene {
  private host!: GameHost;
  private input_!: WalkInput;
  private tiles!: TileRenderer;
  private equipment!: EquipmentRenderer;
  private agents!: AgentRenderer;
  private status!: StatusRenderer;
  private build!: BuildRenderer;
  private buildOn = false;
  private pointerIn = false;
  private cameraTarget!: Phaser.GameObjects.Zone;
  private acc = 0;
  private shownState: GameHost['state'] | null = null;

  constructor() {
    super('LabScene');
  }

  init(data: { host: GameHost }): void {
    this.host = data.host;
    this.acc = 0;
    this.shownState = data.host.state;
  }

  create(): void {
    const { state } = this.host;
    this.tiles = new TileRenderer(this);
    this.equipment = new EquipmentRenderer(this);
    this.agents = new AgentRenderer(this);
    this.status = new StatusRenderer(this);
    this.build = new BuildRenderer(this);
    this.buildOn = false;
    this.pointerIn = false;
    this.tiles.sync(state);
    this.equipment.sync(state);

    this.cameraTarget = this.add.zone(0, 0, 1, 1);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
    cam.setBackgroundColor(PALETTE.moss);
    cam.setRoundPixels(true);
    // The map is as wide as the view, so the camera only ever scrolls vertically.
    cam.startFollow(this.cameraTarget, true, 1, 0.12);
    this.syncAgents(0);
    const p = this.cameraTarget;
    cam.centerOn(p.x, p.y);

    this.input_ = createWalkInput(
      (cmd) => this.host.send(cmd),
      () => stationPrompt(this.host.state)?.options[1]?.jobId,
      () => this.host.ui.blocking > 0,
      () => this.interact(),
      (code) => this.host.ui.panelKey(code),
    );
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', () => {
      this.pointerIn = true;
    });
    this.input.on('gameout', () => {
      this.pointerIn = false;
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.host.ui.build.active) {
        this.buildClick(pointer);
        return;
      }
      if (!pointer.leftButtonDown()) return;
      const w = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const x = Math.floor(w.x / TILE_SIZE);
      const y = Math.floor(w.y / TILE_SIZE);
      this.host.send({ type: 'SetPlayerTarget', x, y });
      if (isWalkable(this.host.state, x, y)) this.showMarker(x, y);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input_.destroy());
  }

  /** E: start a job, press the sweet spot of the running job, or open the station's menu. */
  private interact(): void {
    const { state } = this.host;
    const menu = facedMenu(state);
    const player = state.agents[PLAYER_ID];
    const job = player?.jobId ? state.jobs[player.jobId] : undefined;
    if (menu && !(job && job.stationId === menu.stationId)) this.host.ui.openMenu();
    else this.host.send({ type: 'Interact' });
  }

  update(_time: number, delta: number): void {
    if (this.host.state !== this.shownState) {
      // A new game was loaded: rebuild the scene from the new state.
      this.shownState = this.host.state;
      this.scene.restart({ host: this.host });
      return;
    }
    const { state } = this.host;
    this.syncBuildMode();
    let pending = this.host.drain();

    if (state.clock.speed === 0) {
      // Paused: commands are still handled (so you can resume) but no ticks run.
      this.acc = 0;
      if (pending.length > 0) this.emit(step(state, pending));
    } else {
      this.acc += Math.min(delta, MAX_FRAME_MS) * state.clock.speed;
      let ticks = 0;
      while (this.acc >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
        const cmds: Command[] = pending;
        pending = [];
        const held = this.input_.heldDirection();
        if (held) cmds.push({ type: 'MovePlayer', dir: held });
        this.emit(step(state, cmds));
        this.acc -= TICK_MS;
        ticks++;
        if (this.isPaused()) break; // a command in this tick paused the game
      }
      if (this.acc >= TICK_MS) this.acc = 0; // drop the excess (the tab was asleep)
      if (pending.length > 0) this.host.requeue(pending); // no tick this frame: keep for the next one
    }

    this.tiles.sync(state);
    this.equipment.sync(state);
    this.status.sync(state, this.time.now);
    this.updateGhost();
    this.build.sync(state, this.host.ui.build, this.time.now);
    this.syncAgents(state.clock.speed === 0 ? 0 : this.acc / TICK_MS);
  }

  /** Zooms out for build mode and back in when it ends. */
  private syncBuildMode(): void {
    const on = this.host.ui.build.active;
    if (on === this.buildOn) return;
    this.buildOn = on;
    const cam = this.cameras.main;
    if (on) {
      cam.stopFollow();
      cam.removeBounds();
      cam.setZoom(BUILD_ZOOM);
      // Put the map's top-left corner at the left edge, just under the top bars.
      cam.centerOn(VIEW_W / 2 / BUILD_ZOOM, (VIEW_H / 2 - BUILD_TOP) / BUILD_ZOOM);
    } else {
      cam.setZoom(1);
      cam.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
      cam.startFollow(this.cameraTarget, true, 1, 0.12);
      const p = this.cameraTarget;
      cam.centerOn(p.x, p.y);
    }
  }

  private pointerTile(pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
    const w = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const x = Math.floor(w.x / TILE_SIZE);
    const y = Math.floor(w.y / TILE_SIZE);
    return inBounds(x, y) ? { x, y } : null;
  }

  /** Writes the tile under the cursor and whether the held item fits there. The panel reads it. */
  private updateGhost(): void {
    const b = this.host.ui.build;
    if (!b.active) return;
    b.hover = this.pointerIn ? this.pointerTile(this.input.activePointer) : null;
    if (!b.held || !b.hover) {
      b.valid = false;
      b.hint = null;
      return;
    }
    const { state } = this.host;
    const def = EQUIPMENT[b.held.defId];
    const reason = placementBlocker(state, b.held.defId, b.hover.x, b.hover.y, b.held.rot, b.held.moveId ? { ignoreId: b.held.moveId } : {});
    const price = def?.price ?? 0;
    if (reason) b.hint = reason;
    else if (!b.held.moveId) b.hint = spendBlocker(state, price);
    else b.hint = null;
    b.valid = b.hint === null;
  }

  private buildClick(pointer: Phaser.Input.Pointer): void {
    const b = this.host.ui.build;
    if (pointer.rightButtonDown()) {
      if (b.held) b.held = { ...b.held, rot: ((b.held.rot + 1) % 4) as 0 | 1 | 2 | 3 };
      return;
    }
    if (!pointer.leftButtonDown()) return;
    const tile = this.pointerTile(pointer);
    if (!tile) return;
    const { state } = this.host;
    if (b.held) {
      this.updateGhost();
      if (!b.valid) return;
      if (b.held.moveId) {
        this.host.send({ type: 'MoveEquipment', equipmentId: b.held.moveId, x: tile.x, y: tile.y, rot: b.held.rot });
        b.selectedEquipment = b.held.moveId;
        b.held = null;
      } else {
        this.host.send({ type: 'PlaceEquipment', defId: b.held.defId, x: tile.x, y: tile.y, rot: b.held.rot });
      }
      return;
    }
    const eq = equipmentAt(state, tile.x, tile.y);
    if (eq && plotOf(eq) !== null) {
      b.selectedEquipment = eq.id;
      b.selectedPlot = null;
      return;
    }
    const plotId = this.plotIdAt(tile.x, tile.y);
    if (plotId && !state.plots[plotId]?.owned) {
      b.selectedPlot = plotId;
      b.selectedEquipment = null;
      return;
    }
    b.selectedPlot = null;
    b.selectedEquipment = null;
  }

  private plotIdAt(x: number, y: number): string | null {
    for (const p of PLOTS) if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p.id;
    return null;
  }

  private isPaused(): boolean {
    return this.host.state.clock.speed === 0;
  }

  private syncAgents(tickFraction: number): void {
    const { state } = this.host;
    this.agents.sync(state, tickFraction);
    const player = state.agents[PLAYER_ID];
    if (player) {
      const p = agentWorldPos(player, tickFraction);
      this.cameraTarget.setPosition(p.x, p.y - 8);
    }
  }

  private emit(events: ReturnType<typeof step>): void {
    for (const e of events) this.host.events.emit(e);
  }

  private showMarker(tx: number, ty: number): void {
    const ring = this.add
      .rectangle(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE - 4, TILE_SIZE - 4)
      .setStrokeStyle(1, PALETTE.mustard)
      .setDepth(2);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.5,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
  }
}
