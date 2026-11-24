import { storageFailed } from '../platform/storage';
import { el } from './dom';

/** A banner shown when this browser window cannot store anything (design doc 9). */
export function mountStorageBanner(parent: HTMLElement): void {
  const banner = el('div', 'storage-banner', 'Saving is off in this browser window. Use Copy save code before you close it.');
  banner.setAttribute('role', 'alert');
  banner.hidden = true;
  parent.appendChild(banner);
  const check = (): void => {
    banner.hidden = !storageFailed();
  };
  check();
  setInterval(check, 3000);
}
