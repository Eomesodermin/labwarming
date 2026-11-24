import Phaser from 'phaser';
import type { GameHost } from '../host';
import { BootScene } from './scenes/BootScene';
import { LabScene, VIEW_H, VIEW_W } from './scenes/LabScene';

/** Creates the Phaser game: a 480 by 270 pixel-art view, scaled to fit the window and centred. */
export function createGame(parent: HTMLElement, host: GameHost): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#4A3540',
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
  });
  game.scene.add('BootScene', BootScene, false);
  game.scene.add('LabScene', LabScene, false);
  game.scene.start('BootScene', { host });
  return game;
}
