import Phaser from 'phaser';
import { TICK_MS } from '../../content/balance';
import { MAP_H, MAP_W, TILE_SIZE } from '../../content/map';
import type { GameHost } from '../../host';
import { PLAYER_ID, type Command } from '../../sim/commands';
import { isWalkable } from '../../sim/grid';
import { stationPrompt } from '../../sim/selectors';
import { step } from '../../sim/step';
import { PALETTE } from '../art/palette';
import { createWalkInput, type WalkInput } from '../input/walkInput';
import { AgentRenderer, agentWorldPos } from '../renderers/agentRenderer';
import { EquipmentRenderer } from '../renderers/equipmentRenderer';
import { StatusRenderer } from '../renderers/statusRenderer';
import { TileRenderer } from '../renderers/tileRenderer';

export const VIEW_W = 480;
export const VIEW_H = 270;
const MAX_TICKS_PER_FRAME = 5;
const MAX_FRAME_MS = 500;

/** Draws the lab from GameState each frame and drives the sim at a fixed tick rate. */
export class LabScene extends Phaser.Scene {
  private host!: GameHost;
  private input_!: WalkInput;
  private tiles!: TileRenderer;
  private equipment!: EquipmentRenderer;
  private agents!: AgentRenderer;
  private status!: StatusRenderer;
  private cameraTarget!: Phaser.GameObjects.Zone;
  private acc = 0;

  constructor() {
    super('LabScene');
  }

  init(data: { host: GameHost }): void {
    this.host = data.host;
    this.acc = 0;
  }

  create(): void {
    const { state } = this.host;
    this.tiles = new TileRenderer(this);
    this.equipment = new EquipmentRenderer(this);
    this.agents = new AgentRenderer(this);
    this.status = new StatusRenderer(this);
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
    );
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const w = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const x = Math.floor(w.x / TILE_SIZE);
      const y = Math.floor(w.y / TILE_SIZE);
      this.host.send({ type: 'SetPlayerTarget', x, y });
      if (isWalkable(this.host.state, x, y)) this.showMarker(x, y);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input_.destroy());
  }

  update(_time: number, delta: number): void {
    const { state } = this.host;
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
    this.syncAgents(state.clock.speed === 0 ? 0 : this.acc / TICK_MS);
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
