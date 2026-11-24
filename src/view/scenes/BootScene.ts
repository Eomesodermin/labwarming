import Phaser from 'phaser';
import type { GameHost } from '../../host';
import { generateShapeTextures } from '../art/shapes';

/** Generates the Stage A shape textures, then starts the lab. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(data: { host: GameHost }): void {
    generateShapeTextures(this);
    this.scene.start('LabScene', data);
  }
}
