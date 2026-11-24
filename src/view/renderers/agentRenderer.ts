import Phaser from 'phaser';
import { STEP_COST } from '../../content/balance';
import { TILE_SIZE } from '../../content/map';
import { moveSpeed } from '../../sim/systems/movement';
import type { Agent, GameState } from '../../sim/types';
import { ENERGY, MOOD } from '../../content/staff';
import { isOnBreak } from '../../sim/systems/staff';
import { characterCanvas, characterLook, hashText, type CharFrame } from '../art/spriteRegistry';
import { textureFrom } from '../art/textures';
import { IconPool } from './iconPool';

/** Where an agent is drawn, in world pixels: its tile centre, eased towards the next tile. */
export function agentWorldPos(a: Agent, extraTicks: number): { x: number; y: number } {
  let t = 0;
  const next = a.path[0];
  if (next) t = Math.min(1, Math.max(0, (a.moveProgress + extraTicks * moveSpeed(a)) / STEP_COST));
  const tx = a.x + (next ? (next.x - a.x) * t : 0);
  const ty = a.y + (next ? (next.y - a.y) * t : 0);
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE };
}

/** The walk cycle runs on distance, so feet never slide: stride, stand, stride, stand every 4 pixels. */
export function walkFrame(a: Agent, p: { x: number; y: number }): CharFrame {
  const along = a.facing === 'left' || a.facing === 'right' ? p.x : p.y;
  const phase = ((Math.floor(along / 4) % 4) + 4) % 4;
  if (a.facing === 'left' || a.facing === 'right') return phase % 2 === 0 ? 'A' : 'stand';
  return phase === 0 ? 'A' : phase === 2 ? 'B' : 'stand';
}

/** One sprite per agent. Positions are interpolated between ticks so movement looks smooth. */
export class AgentRenderer {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private icons: IconPool;

  constructor(private scene: Phaser.Scene) {
    this.icons = new IconPool(scene, 4990);
  }

  /** `tickFraction` is how far through the next tick the frame is, 0 to 1. Pass 0 when paused. */
  sync(state: GameState, tickFraction: number, nowMs: number): void {
    this.icons.begin();
    for (const [id, sprite] of this.sprites) {
      if (!state.agents[id]) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
    for (const a of Object.values(state.agents)) {
      const p = agentWorldPos(a, tickFraction);
      const moving = a.path.length > 0;
      let frame: CharFrame = 'stand';
      if (moving) frame = walkFrame(a, p);
      else if (a.jobId && Math.floor(nowMs / 320) % 2 === 0) frame = 'work';
      const look = characterLook(a.kind, a.staff?.colour ?? null, hashText(a.id));
      const key = `ch:${a.kind}:${a.staff?.colour ?? '-'}:${hashText(a.id) % 12}:${a.facing}:${frame}`;
      const tex = textureFrom(this.scene, key, () => characterCanvas(look, a.facing, frame));
      let sprite = this.sprites.get(a.id);
      if (!sprite) {
        sprite = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
        this.sprites.set(a.id, sprite);
      }
      // A tiny bob on the passing frames makes the walk feel lighter.
      const bob = moving && frame === 'stand' ? 1 : 0;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      sprite.setTexture(tex);
      sprite.setPosition(x, y - bob);
      sprite.setDepth(p.y + 1);
      if (a.staff) this.drawIcon(state, a, x, y, nowMs);
      else if (a.kind !== 'player') this.drawProp(state, a, x, y);
    }
    this.icons.end();
  }

  /** Quince's cake, Tock's clipboard, Bodo's box: held in front of them. */
  private drawProp(state: GameState, a: Agent, x: number, y: number): void {
    const side = a.facing === 'left' ? -6 : a.facing === 'right' ? 6 : 0;
    const depth = (a.facing === 'up' ? y : y + 2) + 1;
    if (a.kind === 'inspector') {
      this.icons.put('icon.clip', x + (side === 0 ? 6 : side), y - 4, { depth });
    } else if (a.kind === 'courier') {
      this.icons.put('icon.box', x + side, y - 3, { depth });
    } else if (a.kind === 'pi') {
      const visit = state.director.visits.find((v) => v.agentIds[0] === a.id);
      if (visit?.kind === 'cake' && !visit.arrived && !visit.leaving) this.icons.put('icon.cake', x + side, y - 2, { depth });
    }
  }

  /** A rain cloud over someone in a low mood, a cup over someone on a break, zzz for a rest, an ice bucket in a drill. */
  private drawIcon(state: GameState, a: Agent, x: number, y: number, nowMs: number): void {
    const st = a.staff;
    if (!st) return;
    const top = y - 24 - (Math.floor(nowMs / 500) % 2);
    if (state.director.drill) this.icons.put('icon.bucket', x, top);
    else if (st.restTicks > 0) this.icons.put('icon.zzz', x + 4, top);
    else if (isOnBreak(state, a) || st.energy <= ENERGY.breakAt) this.icons.put('icon.cup', x, top);
    else if (st.mood < MOOD.cloudBelow) this.icons.put('icon.cloud', x, top);
  }

  spriteOf(id: string): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }
}
