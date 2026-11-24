import { PLAYER_MOVE_SPEED, STAFF_MOVE_SPEED, STEP_COST } from '../../content/balance';
import { dirBetween, isWalkable } from '../grid';
import type { Agent, GameState } from '../types';

export function moveSpeed(agent: Agent): number {
  return agent.kind === 'player' ? PLAYER_MOVE_SPEED : STAFF_MOVE_SPEED;
}

/**
 * Tile-based movement. Each tick an agent with a path adds its speed to `moveProgress`.
 * At STEP_COST it steps onto the next tile. Agents do not block each other.
 */
export function movementSystem(state: GameState): void {
  for (const id of Object.keys(state.agents)) {
    const a = state.agents[id] as Agent;
    if (a.path.length === 0) {
      a.moveProgress = 0;
      if (a.arriveFacing) {
        a.facing = a.arriveFacing;
        a.arriveFacing = null;
      }
      continue;
    }
    a.moveProgress += moveSpeed(a);
    while (a.moveProgress >= STEP_COST && a.path.length > 0) {
      const next = a.path[0] as { x: number; y: number };
      if (!isWalkable(state, next.x, next.y)) {
        // The way is blocked (the grid changed). Stop where we are.
        a.path = [];
        a.moveProgress = 0;
        break;
      }
      const dir = dirBetween({ x: a.x, y: a.y }, next);
      if (dir) a.facing = dir;
      a.x = next.x;
      a.y = next.y;
      a.path.shift();
      a.moveProgress -= STEP_COST;
    }
  }
}
