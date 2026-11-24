import Phaser from 'phaser';
import { STEP_COST } from '../../content/balance';
import { TILE_SIZE } from '../../content/map';
import { moveSpeed } from '../../sim/systems/movement';
import type { Agent, GameState } from '../../sim/types';
import { characterSpriteKey, variantKey } from '../art/spriteRegistry';

/** Where an agent is drawn, in world pixels: its tile centre, eased towards the next tile. */
export function agentWorldPos(a: Agent, extraTicks: number): { x: number; y: number } {
  let t = 0;
  const next = a.path[0];
  if (next) t = Math.min(1, Math.max(0, (a.moveProgress + extraTicks * moveSpeed(a)) / STEP_COST));
  const tx = a.x + (next ? (next.x - a.x) * t : 0);
  const ty = a.y + (next ? (next.y - a.y) * t : 0);
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE };
}

/** One sprite per agent. Positions are interpolated between ticks so movement looks smooth. */
export class AgentRenderer {
  private sprites = new Map<string, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  /** `tickFraction` is how far through the next tick the frame is, 0 to 1. Pass 0 when paused. */
  sync(state: GameState, tickFraction: number): void {
    for (const [id, sprite] of this.sprites) {
      if (!state.agents[id]) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
    for (const a of Object.values(state.agents)) {
      const tex = variantKey(characterSpriteKey(a.kind), a.facing);
      let sprite = this.sprites.get(a.id);
      if (!sprite) {
        sprite = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
        this.sprites.set(a.id, sprite);
      }
      const p = agentWorldPos(a, tickFraction);
      sprite.setTexture(tex);
      sprite.setPosition(Math.round(p.x), Math.round(p.y));
      sprite.setDepth(p.y + 1);
    }
  }

  spriteOf(id: string): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }
}
