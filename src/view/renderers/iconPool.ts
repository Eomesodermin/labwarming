import Phaser from 'phaser';
import { spriteCanvas } from '../art/spriteRegistry';
import { textureFrom } from '../art/textures';

/**
 * Small sprites that come and go every frame (warning marks, cups, clouds, boxes). Call `begin`, then
 * `put` for each one, then `end`. Images are reused, and the ones not put this frame are hidden.
 */
export class IconPool {
  private images: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  /** Draws icon `name` (a key such as `icon.cup`) with its bottom centre at (x, y), or its top left if `corner` is set. */
  put(name: string, x: number, y: number, opts: { corner?: boolean; depth?: number } = {}): void {
    const tex = textureFrom(this.scene, name, () => spriteCanvas(name));
    let img = this.images[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, tex);
      this.images.push(img);
    }
    this.used++;
    img.setTexture(tex).setOrigin(opts.corner ? 0 : 0.5, opts.corner ? 0 : 1);
    img.setPosition(Math.round(x), Math.round(y)).setDepth(opts.depth ?? this.depth).setVisible(true);
  }

  end(): void {
    for (let i = this.used; i < this.images.length; i++) this.images[i]?.setVisible(false);
  }
}
