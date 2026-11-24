import type Phaser from 'phaser';
import './styles.css';

/**
 * Mounts the HTML overlay and keeps it exactly over the game canvas, whatever the window size.
 * It also sets `--u`, the size of one game pixel in screen pixels, so panels can scale with the picture.
 */
export function mountUiRoot(root: HTMLElement, game: Phaser.Game): HTMLElement {
  const place = (): void => {
    const canvas = game.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const host = root.parentElement?.getBoundingClientRect();
    root.style.left = `${rect.left - (host?.left ?? 0)}px`;
    root.style.top = `${rect.top - (host?.top ?? 0)}px`;
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
    root.style.setProperty('--u', String(rect.height / 270));
  };
  place();
  game.scale.on('resize', place);
  window.addEventListener('resize', place);
  new ResizeObserver(place).observe(root.parentElement ?? document.body);
  // The canvas is created a moment after the game; place again once it exists.
  game.events.once('ready', place);
  return root;
}
