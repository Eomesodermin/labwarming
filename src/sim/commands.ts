import { FRIDGE_REPAIR_COST } from '../content/economy';
import { coldCapacity, coldUsed, dryCapacity, dryUsed, plotOf, wasteCapacity } from './stock';
import { buyOrder } from './systems/orders';
import { callEngineer, coax } from './systems/machines';
import { chooseOption } from './systems/eventCore';
import { atStation, facedStation, pressSweetSpot, startJob } from './systems/jobs';
import { hireStaff, partWays } from './systems/staff';
import { spendBlocker } from './funds';
import { findPathToAny, findPath } from './pathfinding';
import { EQUIPMENT } from '../content/equipment';
import { FACILITY } from '../content/facility';
import { ROOMS } from '../content/rooms';
import { DIR_VECTORS, ROT_FACING, equipmentAt, frontTiles, isWalkable, opposite } from './grid';
import { buyPlotBlocker, placementBlocker, plotDef, sellInfo, sprayPlacement, upgradeInfo } from './placement';
import type { SimEvent } from './simEvents';
import type { Agent, Dir, Equipment, GameState, Point, Rot, RoomTypeId, Speed } from './types';

/** Commands are the only way to change state from outside. */
export type Command =
  | { type: 'MovePlayer'; dir: Dir }
  | { type: 'SetPlayerTarget'; x: number; y: number; stationId?: string }
  | { type: 'Interact'; stationId?: string; jobId?: string }
  | { type: 'SweetSpotPress' }
  | { type: 'CancelJob' }
  | { type: 'SetSpeed'; speed: Speed }
  | { type: 'TogglePause' }
  | { type: 'PlaceOrder'; orderId: string }
  | { type: 'RepairEquipment'; equipmentId: string }
  | { type: 'MarkEmailRead'; emailId: string }
  | { type: 'BuyPlot'; plotId: string; roomType: RoomTypeId }
  | { type: 'PlaceEquipment'; defId: string; x: number; y: number; rot: Rot }
  | { type: 'MoveEquipment'; equipmentId: string; x: number; y: number; rot: Rot }
  | { type: 'SellEquipment'; equipmentId: string }
  | { type: 'UpgradeEquipment'; equipmentId: string }
  | { type: 'HireStaff'; candidateId: string }
  | { type: 'PartWays'; agentId: string }
  | { type: 'ChooseEventOption'; emailId: string; option: number }
  | { type: 'CoaxAutoclave'; equipmentId: string }
  | { type: 'CallEngineer' }
  | { type: 'SetMediaTarget'; target: number }
  | { type: 'SetAutoReorder'; on: boolean };

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
  player.pendingStation = null;
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

  player.pendingStation = station ? station.id : null;
  player.path = next ? [{ x: next.x, y: next.y }, ...route] : route;
  player.arriveFacing = arriveFacing;
}

function interact(state: GameState, cmd: Extract<Command, { type: 'Interact' }>, events: SimEvent[]): void {
  const player = state.agents[PLAYER_ID];
  if (!player) return;
  if (state.clock.speed === 0) return reject(events, 'Paused');
  if (player.path.length > 0) return; // still walking: ignore
  const eq = cmd.stationId ? state.equipment[cmd.stationId] : facedStation(state, player);
  if (!eq) return reject(events, 'Nothing to use here');
  if (!atStation(player, eq)) return reject(events, 'Stand in front of it to use it');
  const active = player.jobId ? state.jobs[player.jobId] : undefined;
  if (active && active.stationId === eq.id && (!cmd.jobId || cmd.jobId === active.defId)) {
    pressSweetSpot(state, active, events);
    return;
  }
  startJob(state, eq, cmd.jobId, events);
}

function sweetSpotPress(state: GameState, events: SimEvent[]): void {
  const player = state.agents[PLAYER_ID];
  const job = player?.jobId ? state.jobs[player.jobId] : undefined;
  const eq = job ? state.equipment[job.stationId] : undefined;
  if (player && job && eq && atStation(player, eq)) pressSweetSpot(state, job, events);
}

function placeOrder(state: GameState, orderId: string, events: SimEvent[]): void {
  const why = buyOrder(state, orderId, events);
  if (why) reject(events, why);
}

function repairEquipment(state: GameState, equipmentId: string, events: SimEvent[]): void {
  const eq = state.equipment[equipmentId];
  if (!eq || !eq.broken || eq.defId !== 'fridge') return reject(events, 'Nothing to repair');
  const why = spendBlocker(state, FRIDGE_REPAIR_COST);
  if (why) return reject(events, why);
  state.funds -= FRIDGE_REPAIR_COST;
  eq.broken = false;
  events.push({ type: 'Purchase', what: 'Repair' });
  events.push({ type: 'Toast', text: 'Fridge repaired. It hums happily' });
}

/** Call after anything that changes walkability: new rooms, placed, moved or sold equipment. */
function gridChanged(state: GameState): void {
  state.gridVersion += 1;
  // A walk that now crosses something is stopped. Everyone stays on the tile they stand on.
  // Staff whose way is gone find a new one on their next tick.
  for (const a of Object.values(state.agents)) {
    if (!a.path.some((p) => !isWalkable(state, p.x, p.y))) continue;
    a.path = [];
    a.moveProgress = 0;
    a.arriveFacing = null;
    a.pendingStation = null;
  }
}

function newEquipment(state: GameState, defId: string, x: number, y: number, rot: Rot): Equipment {
  const eq: Equipment = { id: `eq${state.nextId++}`, defId, tier: 1, x, y, rot, broken: false, cycle: null };
  state.equipment[eq.id] = eq;
  return eq;
}

function buyPlot(state: GameState, plotId: string, roomType: RoomTypeId, events: SimEvent[]): void {
  const blocker = buyPlotBlocker(state, plotId, roomType);
  if (blocker) return reject(events, blocker);
  const room = ROOMS[roomType];
  const plot = state.plots[plotId];
  const def = plotDef(plotId);
  if (!plot || !def) return;
  state.funds -= room.cost;
  plot.owned = true;
  plot.roomType = roomType;
  plot.cleanliness = 100;
  plot.waste = 0;
  const spray = sprayPlacement(def);
  newEquipment(state, 'spray', spray.x, spray.y, spray.rot);
  state.stats.plotsBought += 1;
  gridChanged(state);
  events.push({ type: 'Purchase', what: room.name });
  events.push({ type: 'Toast', text: `${room.name} built. The door is open` });
}

function placeEquipment(state: GameState, cmd: Extract<Command, { type: 'PlaceEquipment' }>, events: SimEvent[]): void {
  const blocker = placementBlocker(state, cmd.defId, cmd.x, cmd.y, cmd.rot);
  if (blocker) return reject(events, blocker);
  const def = EQUIPMENT[cmd.defId];
  const price = def?.price ?? 0;
  const why = spendBlocker(state, price);
  if (why) return reject(events, why);
  state.funds -= price;
  newEquipment(state, cmd.defId, cmd.x, cmd.y, cmd.rot);
  gridChanged(state);
  events.push({ type: 'Purchase', what: def?.name ?? cmd.defId });
}

function moveEquipment(state: GameState, cmd: Extract<Command, { type: 'MoveEquipment' }>, events: SimEvent[]): void {
  const eq = state.equipment[cmd.equipmentId];
  if (!eq || !EQUIPMENT[eq.defId] || EQUIPMENT[eq.defId]?.price === null) return reject(events, 'That cannot be moved');
  if (eq.defId === 'autoclave' && eq.cycle) return reject(events, 'Wait for the cycle to finish');
  const blocker = placementBlocker(state, eq.defId, cmd.x, cmd.y, cmd.rot, { ignoreId: eq.id });
  if (blocker) return reject(events, blocker);
  eq.x = cmd.x;
  eq.y = cmd.y;
  eq.rot = cmd.rot;
  // Cultures and jobs follow the equipment by id, so they carry on. The player has to walk over again.
  gridChanged(state);
  events.push({ type: 'Toast', text: `${EQUIPMENT[eq.defId]?.name ?? 'It'} moved` });
}

function sellEquipment(state: GameState, equipmentId: string, events: SimEvent[]): void {
  const eq = state.equipment[equipmentId];
  if (!eq) return reject(events, 'Nothing to sell');
  const info = sellInfo(state, eq);
  if (info.blocker) return reject(events, info.blocker);
  // Storage must still hold what is stored once this is gone.
  const probe = { ...state, equipment: { ...state.equipment } };
  delete probe.equipment[eq.id];
  if (eq.defId === 'fridge' && coldUsed(state) > coldCapacity(probe)) return reject(events, 'The stock would not fit without it');
  if (eq.defId === 'shelf' && dryUsed(state) > dryCapacity(probe)) return reject(events, 'The stock would not fit without it');
  const plotId = plotOf(eq);
  if (eq.defId === 'bin' && plotId && (state.plots[plotId]?.waste ?? 0) > wasteCapacity(probe, plotId)) {
    return reject(events, 'Take the waste out first');
  }
  delete state.equipment[eq.id];
  for (const j of Object.values(state.jobs)) if (j.stationId === eq.id) delete state.jobs[j.id];
  const player = state.agents[PLAYER_ID];
  if (player) {
    if (player.jobId && !state.jobs[player.jobId]) player.jobId = null;
    if (player.pendingStation === eq.id) player.pendingStation = null;
  }
  state.funds += info.refund;
  gridChanged(state);
  events.push({ type: 'Purchase', what: 'Sale' });
  events.push({ type: 'Toast', text: `Sold the ${(EQUIPMENT[eq.defId]?.name ?? 'item').toLowerCase()} for ${info.refund}` });
}

function upgradeEquipment(state: GameState, equipmentId: string, events: SimEvent[]): void {
  const eq = state.equipment[equipmentId];
  if (!eq) return reject(events, 'Nothing to upgrade');
  const info = upgradeInfo(state, eq);
  if (info.blocker) return reject(events, info.blocker);
  state.funds -= info.price;
  eq.tier += 1;
  events.push({ type: 'Purchase', what: 'Upgrade' });
  events.push({ type: 'Toast', text: `${EQUIPMENT[eq.defId]?.name ?? 'Item'} upgraded to tier ${eq.tier}` });
}

export function applyCommand(state: GameState, cmd: Command, events: SimEvent[]): void {
  switch (cmd.type) {
    case 'MovePlayer':
      return movePlayer(state, cmd.dir, events);
    case 'SetPlayerTarget':
      return setPlayerTarget(state, cmd, events);
    case 'Interact':
      return interact(state, cmd, events);
    case 'SweetSpotPress':
      return sweetSpotPress(state, events);
    case 'CancelJob': {
      const p = state.agents[PLAYER_ID];
      if (p) {
        p.jobId = null;
        p.pendingStation = null;
      }
      return;
    }
    case 'SetSpeed':
      return setSpeed(state, cmd.speed, events);
    case 'PlaceOrder':
      return placeOrder(state, cmd.orderId, events);
    case 'RepairEquipment':
      return repairEquipment(state, cmd.equipmentId, events);
    case 'MarkEmailRead': {
      const mail = state.inbox.find((m) => m.id === cmd.emailId);
      if (mail) mail.read = true;
      return;
    }
    case 'BuyPlot':
      return buyPlot(state, cmd.plotId, cmd.roomType, events);
    case 'PlaceEquipment':
      return placeEquipment(state, cmd, events);
    case 'MoveEquipment':
      return moveEquipment(state, cmd, events);
    case 'SellEquipment':
      return sellEquipment(state, cmd.equipmentId, events);
    case 'UpgradeEquipment':
      return upgradeEquipment(state, cmd.equipmentId, events);
    case 'HireStaff':
      return hireStaff(state, cmd.candidateId, events);
    case 'PartWays':
      return partWays(state, cmd.agentId, events);
    case 'ChooseEventOption':
      return chooseOption(state, cmd.emailId, cmd.option, events);
    case 'CoaxAutoclave':
      return coax(state, cmd.equipmentId, events);
    case 'CallEngineer':
      return callEngineer(state, events);
    case 'SetMediaTarget': {
      if (!Number.isFinite(cmd.target)) return reject(events, 'That is not a number');
      state.facility.target = Math.min(FACILITY.targetMax, Math.max(FACILITY.targetMin, Math.round(cmd.target)));
      return;
    }
    case 'SetAutoReorder':
      state.facility.autoReorder = cmd.on === true;
      return;
    case 'TogglePause':
      return setSpeed(state, state.clock.speed === 0 ? state.clock.resumeSpeed : 0, events);
  }
}
