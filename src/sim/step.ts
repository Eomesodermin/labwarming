import { applyCommand, type Command } from './commands';
import type { SimEvent } from './simEvents';
import type { GameState } from './types';
import { clockSystem } from './systems/clock';
import { directorSystem } from './systems/director';
import { endOfDay } from './systems/economy';
import { grantsSystem } from './systems/grants';
import { ordersSystem } from './systems/orders';
import { papersSystem } from './systems/papers';
import { culturesSystem } from './systems/cultures';
import { jobsSystem } from './systems/jobs';
import { machinesSystem } from './systems/machines';
import { movementSystem } from './systems/movement';
import { needsSystem, staffAiSystem, staffWorkSystem } from './systems/staff';

/**
 * Advances the game by one tick and returns that tick's events. Mutates the state.
 *
 * While the game is paused (speed 0) the commands are still handled, but the world does not
 * move and the tick counter does not advance.
 *
 * System order (design doc 8.6): commands, clock, director, orders, cultures, machines,
 * staffAi, movement, jobs, needs, cleanliness, papers, grants, visitors, inspection,
 * economy, goals, tutorial. Only the systems that exist so far are called, in that order (clock, director, orders, cultures, machines, staffAi, movement, jobs, staff work, needs, papers, grants, economy).
 */
export function step(state: GameState, commands: readonly Command[]): SimEvent[] {
  const events: SimEvent[] = [];
  for (const cmd of commands) applyCommand(state, cmd, events);
  if (state.clock.speed === 0) return events;
  const endedDay = state.clock.day;
  const dayEnded = clockSystem(state, events);
  directorSystem(state, events);
  ordersSystem(state, events);
  culturesSystem(state, events);
  machinesSystem(state, events);
  staffAiSystem(state);
  movementSystem(state);
  jobsSystem(state, events);
  staffWorkSystem(state, events);
  needsSystem(state);
  papersSystem(state, events);
  grantsSystem(state, events);
  if (dayEnded) endOfDay(state, endedDay, events);
  return events;
}
