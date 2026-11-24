import type { Command } from '../../sim/commands';
import type { Dir } from '../../sim/types';

const DIR_KEYS: Record<string, Dir> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** True when the key event came from a text field. Game keys are ignored then. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export interface WalkInput {
  /** The direction key that is held right now (the most recently pressed one), if any. */
  heldDirection(): Dir | null;
  destroy(): void;
}

/**
 * Walk mode keys (design doc 3.1). Handlers only queue commands. Held direction keys are
 * re-sent every tick by the scene so that holding a key keeps walking.
 */
export function createWalkInput(
  send: (cmd: Command) => void,
  /** The job that Q starts at the faced station (the second one), if there is one. */
  altJob: () => string | undefined,
  /** True while a panel is open. Game keys are ignored then. */
  blocked: () => boolean,
  /** E or Space. The scene decides between a job, the sweet-spot press and a station menu. */
  onInteract: () => void,
  /** Letter and function keys that open panels (F for a note, I for the inbox). */
  onPanelKey: (code: string) => boolean,
): WalkInput {
  const held: Dir[] = [];

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (blocked()) return;
    const dir = DIR_KEYS[e.code];
    if (dir) {
      e.preventDefault();
      if (!held.includes(dir)) {
        held.push(dir);
        send({ type: 'MovePlayer', dir });
      }
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyP':
        send({ type: 'TogglePause' });
        break;
      case 'Digit1':
      case 'Numpad1':
        send({ type: 'SetSpeed', speed: 1 });
        break;
      case 'Digit2':
      case 'Numpad2':
        send({ type: 'SetSpeed', speed: 2 });
        break;
      case 'KeyE':
      case 'Space':
        e.preventDefault();
        onInteract();
        break;
      case 'KeyQ': {
        const jobId = altJob();
        if (jobId) send({ type: 'Interact', jobId });
        break;
      }
      case 'Escape':
        send({ type: 'CancelJob' });
        break;
      default:
        if (onPanelKey(e.code)) e.preventDefault();
        break;
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const dir = DIR_KEYS[e.code];
    if (!dir) return;
    const i = held.indexOf(dir);
    if (i >= 0) held.splice(i, 1);
  };

  const onBlur = (): void => {
    held.length = 0;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    heldDirection: () => held[held.length - 1] ?? null,
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
