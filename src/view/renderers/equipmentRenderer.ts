import Phaser from 'phaser';
import { TILE_SIZE } from '../../content/map';
import { footprintSize } from '../../sim/grid';
import { plotOf, wasteCapacity } from '../../sim/stock';
import type { GameState } from '../../sim/types';
import { equipmentCanvas, equipState } from '../art/spriteRegistry';
import { textureFrom } from '../art/textures';

/** One sprite per piece of equipment, created and destroyed as entities appear and disappear. */
export class EquipmentRenderer {
  private sprites = new Map<string, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  sync(state: GameState): void {
    for (const [id, sprite] of this.sprites) {
      if (!state.equipment[id]) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
    for (const eq of Object.values(state.equipment)) {
      const plot = eq.defId === 'bin' ? plotOf(eq) : null;
      const full = plot !== null && (state.plots[plot]?.waste ?? 0) >= Math.max(1, wasteCapacity(state, plot));
      const st = equipState(eq, full);
      const tex = textureFrom(this.scene, `eq:${eq.defId}|${eq.tier}|${eq.rot}|${st}`, () => equipmentCanvas(eq.defId, eq.tier, eq.rot, st));
      let sprite = this.sprites.get(eq.id);
      if (!sprite) {
        sprite = this.scene.add.image(0, 0, tex).setOrigin(0, 0);
        this.sprites.set(eq.id, sprite);
      }
      sprite.setTexture(tex);
      sprite.setPosition(eq.x * TILE_SIZE, eq.y * TILE_SIZE);
      sprite.setDepth((eq.y + footprintSize(eq).h) * TILE_SIZE);
    }
  }
}
