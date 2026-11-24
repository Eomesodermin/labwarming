import { findPathToAny, findPath } from './pathfinding';
import { DIR_VECTORS, ROT_FACING, equipmentAt, frontTiles, isWalkable, opposite } from './grid';
import type { SimEvent } from './simEvents';
import type { Agent, Dir, GameState, Point, Speed } from './types';

/** Commands are the only way to change state from outside. */
export type Command =
  | { type: 'MovePlayer'; dir: Dir }
  | { type: 'SetPlayerTarget'; x: number; y: number; stationId?: string }
  | { type: 'SetSpeed'; speed: Speed }
  | { type: 'TogglePause' };

export const PLAYER_ID = 'player';

function reject(events: SimEvent[], reason: string): void {
  events.push({ type: 'CommandRejected', reason });
}

function setSpeed(state: GameState, speed: Speed, events: SimEvent[]): void {
  if (state.clock.speed === speed) return;
  state.clock.speed = speed;
  if (speed !== 0) state.clock.resumeSpeed = speed;
  events.push({ type: 'SpeedChanged', speed });
}

/** The last tile the agent is heading for, or the tile it stands on. */
function pathEnd(a: Agent): { x: number; y: number } {
  return a.path.length > 0 ? (a.path[a.path.length - 1] as { x: number; y: number }) : { x: a.x, y: a.y };
}

function movePlayer(state: GameState, dir: Dir, events: SimEvent[]): void {
  const player = state.agents[PLAYER_ID];
  if (!player) return;
  if (state.clock.speed === 0) return reject(events, 'Paused');

  const moving = player.path.length > 0;
  if (!moving) player.facing = dir;
  // One tile per press. While a step is more than half done, one more tile may be queued so
  // that holding a key walks without a pause between tiles.
  if (moving && (player.path.length > 1 || player.moveProgress < 50)) return;

  const end = pathEnd(player);
  const v = DIR_VECTORS[dir];
  const nx = end.x + v.x;
  const ny = end.y + v.y;
  if (!isWalkable(state, nx, ny)) return; // bumping into a wall just turns the player
  player.path.push({ x: nx, y: ny });
  player.arriveFacing = null;
}

function setPlayerTarget(
  state: GameState,
  cmd: Extract<Command, { type: 'SetPlayerTarget' }>,
  events: SimEvent[],
): void {
  const player = state.agents[PLAYER_ID];
  if (!player) return;
  if (state.clock.speed === 0) return reject(events, 'Paused');

  // A step in progress is finished first, then the new route starts from that tile.
  const next = player.path[0];
  const origin = next ? { x: next.x, y: next.y } : { x: player.x, y: player.y };

  let route: Point[] | null;
  let arriveFacing: Dir | null = null;
  const station = cmd.stationId ? state.equipment[cmd.stationId] : equipmentAt(state, cmd.x, cmd.y);
  if (station) {
    const fronts = frontTiles(station);
    route = findPathToAny(state, origin, fronts);
    // Stand in front of the equipment and look at it.
    arriveFacing = opposite(ROT_FACING[station.rot]);
  } else {
    route = findPath(state, origin, { x: cmd.x, y: cmd.y });
  }
  if (!route) return reject(events, 'No way to get there');

  player.path = next ? [{ x: next.x, y: next.y }, ...route] : route;
  player.arriveFacing = arriveFacing;
}

export function applyCommand(state: GameState, cmd: Command, events: SimEvent[]): void {
  switch (cmd.type) {
    case 'MovePlayer':
      return movePlayer(state, cmd.dir, events);
    case 'SetPlayerTarget':
      return setPlayerTarget(state, cmd, events);
    case 'SetSpeed':
      return setSpeed(state, cmd.speed, events);
    case 'TogglePause':
      return setSpeed(state, state.clock.speed === 0 ? state.clock.resumeSpeed : 0, events);
  }
}
