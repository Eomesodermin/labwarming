import type { GameHost } from '../host';

/** Short messages near the bottom of the screen: rejections, "Nice!", Data gained. */
export function mountToasts(root: HTMLElement, host: GameHost): void {
  const box = document.createElement('div');
  box.className = 'toasts';
  box.setAttribute('aria-live', 'polite');
  root.appendChild(box);

  const show = (text: string, kind: 'good' | 'warn' | 'info'): void => {
    if (box.lastElementChild?.textContent === text) return; // no stacked duplicates
    const t = document.createElement('div');
    t.className = `toast toast--${kind}`;
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 4) box.firstElementChild?.remove();
    setTimeout(() => t.remove(), 2600);
  };

  host.events.on((e) => {
    switch (e.type) {
      case 'CommandRejected':
        if (e.reason !== 'Paused') show(e.reason, 'warn');
        break;
      case 'SweetSpot':
        if (e.hit) show('Nice!', 'good');
        break;
      case 'Toast':
        show(e.text, 'info');
        break;
      case 'CultureReady':
        show('A culture is ready', 'info');
        break;
      case 'CultureContaminated':
        show('Something is growing in the incubator. It is not your cells. It seems happy.', 'warn');
        break;
      default:
        break;
    }
  });
}
