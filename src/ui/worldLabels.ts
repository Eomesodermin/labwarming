import type { GameHost } from '../host';
import { esc } from './dom';

const VIEW_W = 480;
const VIEW_H = 270;

/**
 * Text that belongs to the picture but is drawn as HTML so it stays sharp: the name of whatever is
 * under the cursor, and the room names in build mode. The scene writes positions in game pixels.
 */
export function mountWorldLabels(root: HTMLElement, host: GameHost): void {
  const layer = document.createElement('div');
  layer.className = 'worldtext';
  layer.setAttribute('aria-hidden', 'true');
  root.appendChild(layer);
  const tip = document.createElement('div');
  tip.className = 'worldtip';
  tip.hidden = true;
  layer.appendChild(tip);
  const rooms = document.createElement('div');
  layer.appendChild(rooms);

  let lastRooms = '';
  const frame = (): void => {
    const w = host.ui.world;
    const pct = (v: number, max: number): string => `${((v / max) * 100).toFixed(2)}%`;
    if (w.tip) {
      tip.hidden = false;
      if (tip.textContent !== w.tip.text) tip.textContent = w.tip.text;
      tip.style.left = pct(w.tip.gx, VIEW_W);
      tip.style.top = pct(w.tip.gy, VIEW_H);
      // Keep it on screen: flip to the left of the cursor near the right edge.
      tip.classList.toggle('worldtip--left', w.tip.gx > VIEW_W * 0.7);
    } else if (!tip.hidden) tip.hidden = true;
    const html = w.labels.map((l) => `<span class="roomname" style="left:${pct(l.gx, VIEW_W)};top:${pct(l.gy, VIEW_H)}">${esc(l.text)}</span>`).join('');
    if (html !== lastRooms) {
      rooms.innerHTML = html;
      lastRooms = html;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
