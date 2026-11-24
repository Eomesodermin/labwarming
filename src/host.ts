import { Emitter } from './bus';
import type { Command } from './sim/commands';
import type { SimEvent } from './sim/simEvents';
import type { GameState, Speed } from './sim/types';

/** Flags and hooks the ui layer sets and the view reads. They are never saved. */
export interface UiFlags {
  /** Greater than 0 while a panel is open. Game keys are ignored then. */
  blocking: number;
  /** How many panels want the game paused, and the speed to go back to. */
  pauseHolds: number;
  restoreSpeed: Speed | null;
  /** Opens the menu of the station the player faces. Set by the ui. */
  openMenu: () => void;
  /** Opens a panel for a key (F note, I inbox). Returns true if the key was used. */
  panelKey: (code: string) => boolean;
}

/**
 * What the view and ui share: the live state (read-only for them), a command queue and the event bus.
 * Input handlers never change state. They call `send`, and the view feeds the queue to `step`.
 * The state object is replaced as a whole when a game is loaded or a new game starts.
 */
export interface GameHost {
  state: GameState;
  readonly events: Emitter<SimEvent>;
  readonly ui: UiFlags;
  /** False until a game has started, so the title screen never overwrites a save. */
  saving: boolean;
  send(cmd: Command): void;
  drain(): Command[];
  requeue(cmds: Command[]): void;
  /** Swaps in a whole new game state (load, import, new game). The view restarts its scene. */
  replaceState(state: GameState): void;
}

export function createHost(state: GameState): GameHost {
  let queue: Command[] = [];
  const host: GameHost = {
    state,
    events: new Emitter<SimEvent>(),
    ui: { blocking: 0, pauseHolds: 0, restoreSpeed: null, openMenu: () => undefined, panelKey: () => false },
    saving: false,
    send: (cmd) => {
      queue.push(cmd);
    },
    drain: () => {
      const out = queue;
      queue = [];
      return out;
    },
    requeue: (cmds) => {
      queue = [...cmds, ...queue];
    },
    replaceState: (next) => {
      queue = [];
      host.ui.pauseHolds = 0;
      host.ui.restoreSpeed = null;
      host.state = next;
    },
  };
  return host;
}
