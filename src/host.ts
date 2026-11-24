import { Emitter } from './bus';
import type { Command } from './sim/commands';
import type { SimEvent } from './sim/simEvents';
import type { GameState, Point, Rot, Speed } from './sim/types';

/** Build mode, shared by the scene (ghost, clicks) and the side panel. Never saved. */
export interface BuildUi {
  active: boolean;
  /** The item on the cursor. `moveId` is set when an existing piece is being moved. */
  held: { defId: string; rot: Rot; moveId: string | null } | null;
  /** The tile under the cursor, or null when the cursor is off the map. */
  hover: Point | null;
  /** The ghost: whether it can go here, and the reason if not. Written by the scene each frame. */
  valid: boolean;
  hint: string | null;
  selectedEquipment: string | null;
  selectedPlot: string | null;
}

export function freshBuild(): BuildUi {
  return { active: false, held: null, hover: null, valid: false, hint: null, selectedEquipment: null, selectedPlot: null };
}

/** Text the scene wants shown over the picture. The ui draws it as HTML so it stays crisp. Positions are in game pixels (480 by 270). */
export interface WorldUi {
  /** What is under the cursor: a piece of equipment or a plot for sale. */
  tip: { text: string; gx: number; gy: number } | null;
  /** Room names, shown in build mode. */
  labels: Array<{ text: string; gx: number; gy: number }>;
}

/** Flags and hooks the ui layer sets and the view reads. They are never saved. */
export interface UiFlags {
  /** Greater than 0 while a panel is open. Game keys are ignored then. */
  blocking: number;
  /** How many panels want the game paused, and the speed to go back to. */
  pauseHolds: number;
  restoreSpeed: Speed | null;
  /** Opens the menu of the station the player faces. Set by the ui. */
  openMenu: () => void;
  /** Build mode (design doc 3.2). */
  build: BuildUi;
  /** Hover names and room labels, written by the scene and drawn by the ui. */
  world: WorldUi;
  /** Turns build mode on or off. Set by the ui. */
  setBuild: (on: boolean) => void;
  /** Opens the Lab panel on a tab. Set by the ui. */
  openLab: (tab: 'goals' | 'media') => void;
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
    ui: { blocking: 0, pauseHolds: 0, restoreSpeed: null, openMenu: () => undefined, build: freshBuild(), world: { tip: null, labels: [] }, setBuild: () => undefined, openLab: () => undefined, panelKey: () => false },
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
      host.ui.build = freshBuild();
      host.state = next;
    },
  };
  return host;
}
