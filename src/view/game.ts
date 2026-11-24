import Phaser from 'phaser';
import type { GameHost } from '../host';
import { LabScene, VIEW_H, VIEW_W } from './scenes/LabScene';

/**
 * How much to enlarge the 480 by 270 picture. A whole number keeps every pixel the same size and
 * perfectly crisp. If the window would be left with big empty borders (less than 75% filled) the
 * picture grows to fit instead, which is the only time pixels are uneven.
 */
export function bestZoom(parent: HTMLElement): number {
  const fit = Math.min(parent.clientWidth / VIEW_W, parent.clientHeight / VIEW_H);
  if (!(fit > 0)) return 1;
  const whole = Math.floor(fit);
  return whole >= 1 && whole / fit >= 0.75 ? whole : fit;
}

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
    antialias: false,
    audio: { noAudio: true },
    input: { keyboard: false },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: bestZoom(parent) },
    scene: [],
  });
  game.scene.add('LabScene', LabScene, false);
  game.scene.start('LabScene', { host });
  // Keep the picture a whole number of screen pixels per game pixel when the window allows it.
  const refit = (): void => {
    game.scale.setZoom(bestZoom(parent));
    window.dispatchEvent(new Event('labwarming:zoom'));
  };
  window.addEventListener('resize', refit);
  new ResizeObserver(refit).observe(parent);
  return game;
}
