import { Emitter } from './bus';
import type { Command } from './sim/commands';
import type { SimEvent } from './sim/simEvents';
import type { GameState } from './sim/types';

/**
 * What the view and ui share: the live state (read-only for them), a command queue and the event bus.
 * Input handlers never change state. They call `send`, and the view feeds the queue to `step`.
 */
export interface GameHost {
  readonly state: GameState;
  readonly events: Emitter<SimEvent>;
  send(cmd: Command): void;
  drain(): Command[];
  requeue(cmds: Command[]): void;
}

export function createHost(state: GameState): GameHost {
  let queue: Command[] = [];
  return {
    state,
    events: new Emitter<SimEvent>(),
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
  };
}
