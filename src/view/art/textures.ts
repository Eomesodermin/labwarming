import type Phaser from 'phaser';

/** Makes sure a Phaser texture exists for a canvas, and returns its key. The canvas is only built the first time. */
export function textureFrom(scene: Phaser.Scene, key: string, make: () => HTMLCanvasElement): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  return key;
}
