import { AUTOSAVE_SEC } from '../content/balance';
import type { GameHost } from '../host';
import { writeSave } from './saveStore';

/**
 * Saves at every end-of-day card, every 60 real seconds, when the tab is hidden or closed, and
 * after any purchase (design doc 9). Returns a function that saves right now.
 */
export function startAutosave(host: GameHost): () => boolean {
  const save = (): boolean => (host.saving ? writeSave(host.state) : false);
  setInterval(save, AUTOSAVE_SEC * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);
  host.events.on((e) => {
    if (e.type === 'EndOfDay' || e.type === 'Purchase') save();
  });
  return save;
}
