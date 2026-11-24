import { applyCommand, type Command } from './commands';
import type { SimEvent } from './simEvents';
import type { GameState } from './types';
import { clockSystem } from './systems/clock';
import { movementSystem } from './systems/movement';

/**
 * Advances the game by one tick and returns that tick's events. Mutates the state.
 *
 * While the game is paused (speed 0) the commands are still handled, but the world does not
 * move and the tick counter does not advance.
 *
 * System order (design doc 8.6): commands, clock, director, orders, cultures, machines,
 * staffAi, movement, jobs, needs, cleanliness, papers, grants, visitors, inspection,
 * economy, goals, tutorial. Only the systems that exist so far are called.
 */
export function step(state: GameState, commands: readonly Command[]): SimEvent[] {
  const events: SimEvent[] = [];
  for (const cmd of commands) applyCommand(state, cmd, events);
  if (state.clock.speed === 0) return events;
  clockSystem(state, events);
  movementSystem(state);
  return events;
}
