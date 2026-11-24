import Phaser from 'phaser';
import { STEP_COST } from '../../content/balance';
import { TILE_SIZE } from '../../content/map';
import { moveSpeed } from '../../sim/systems/movement';
import type { Agent, GameState } from '../../sim/types';
import { ENERGY, MOOD } from '../../content/staff';
import { isOnBreak } from '../../sim/systems/staff';
import { PALETTE } from '../art/palette';
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
  private icons: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.icons = scene.add.graphics().setDepth(4990);
  }

  /** `tickFraction` is how far through the next tick the frame is, 0 to 1. Pass 0 when paused. */
  sync(state: GameState, tickFraction: number): void {
    this.icons.clear();
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
      if (a.staff) this.drawIcon(state, a, Math.round(p.x), Math.round(p.y));
    }
  }

  /** A rain cloud over someone in a low mood, a coffee cup over someone who is on or heading for a break. */
  private drawIcon(state: GameState, a: Agent, x: number, y: number): void {
    const st = a.staff;
    if (!st) return;
    const g = this.icons;
    const top = y - 28;
    if (isOnBreak(state, a) || st.energy <= ENERGY.breakAt) {
      g.fillStyle(PALETTE.plum).fillRect(x - 4, top - 1, 8, 8);
      g.fillStyle(PALETTE.paper).fillRect(x - 3, top, 6, 6);
      g.fillStyle(PALETTE.terracotta).fillRect(x - 3, top + 1, 6, 2);
      g.fillStyle(PALETTE.plum).fillRect(x + 4, top + 1, 2, 4);
    } else if (st.mood < MOOD.cloudBelow) {
      g.fillStyle(PALETTE.plum).fillRect(x - 6, top + 1, 12, 5).fillRect(x - 4, top - 1, 8, 3);
      g.fillStyle(PALETTE.slate).fillRect(x - 5, top + 2, 10, 3).fillRect(x - 3, top, 6, 2);
      g.fillStyle(PALETTE.sky).fillRect(x - 3, top + 7, 1, 2).fillRect(x + 1, top + 8, 1, 2);
    }
  }

  spriteOf(id: string): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }
}
