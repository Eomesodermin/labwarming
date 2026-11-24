import { STAFF_MOVE_SPEED, STEP_COST } from '../../content/balance';
import { FAILURES } from '../../content/events';
import { ENTRANCE } from '../../content/map';
import { DELIVERY_SEC } from '../../content/orders';
import { ORDERS, isKnownOrder } from '../../content/orders';
import { orderBlocker } from '../funds';
import { findPath } from '../pathfinding';
import { secondsToTicks } from '../ticks';
import type { SimEvent } from '../simEvents';
import type { GameState, Order, Point } from '../types';
import { failuresAllowed } from './director';
import { dChance, dInt, fireEvent } from './eventCore';
import { bayFront, corridorTiles, spawnVisit } from './visits';

/**
 * Called when an order is placed. It may go wrong (design doc 6.3): the box may be delivered to
 * the wrong place, or the kits may be swapped for pipette tips and arrive late. Then Bodo is
 * planned to walk in a little before the box appears.
 */
export function rollOrderFailures(state: GameState, order: Order, events: SimEvent[]): void {
  if (failuresAllowed(state)) {
    if (state.stats.ordersPlaced > FAILURES.lostOrder.afterOrders && dChance(state, FAILURES.lostOrder.chance)) {
      order.lost = true;
    } else if (order.orderId === FAILURES.substitution.orderId && dChance(state, FAILURES.substitution.chance)) {
      order.ticksLeft += secondsToTicks(FAILURES.substitution.lateSec);
      fireEvent(state, 'fail_substitution', events);
    }
  }
  let drop: Point = bayFront(state);
  if (order.lost) {
    const tiles = corridorTiles(state);
    if (tiles.length > 0) drop = tiles[dInt(state, tiles.length)] as Point;
  }
  order.dropAt = drop;
  const route = findPath(state, ENTRANCE, drop);
  const walkTicks = Math.ceil(((route?.length ?? 6) * STEP_COST) / STAFF_MOVE_SPEED);
  order.courierAt = walkTicks + 4;
}

/** Orders count down. Bodo walks in just before. When one arrives, its box waits at the delivery bay, or is lost. */
export function ordersSystem(state: GameState, events: SimEvent[]): void {
  if (state.orders.length === 0) return;
  const arrived: string[] = [];
  for (const o of state.orders) {
    o.ticksLeft -= 1;
    if (!o.courierSent && o.courierAt !== undefined && o.ticksLeft <= o.courierAt) {
      o.courierSent = true;
      spawnVisit(state, 'courier', events, o.dropAt);
    }
    if (o.ticksLeft <= 0) arrived.push(o.id);
  }
  if (arrived.length === 0) return;
  for (const id of arrived) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) continue;
    state.orders = state.orders.filter((x) => x.id !== id);
    const def = isKnownOrder(o.orderId) ? ORDERS[o.orderId] : undefined;
    if (!def) continue;
    if (o.lost) {
      const at = o.dropAt ?? bayFront(state);
      state.lostBoxes.push({ id: `b${state.nextId++}`, orderId: def.id, qty: def.qty, x: at.x, y: at.y });
      fireEvent(state, 'fail_lost_order', events);
      continue;
    }
    const box = { id: `b${state.nextId++}`, orderId: def.id, qty: def.qty };
    state.boxes.push(box);
    events.push({ type: 'BoxDelivered', boxId: box.id });
    events.push({ type: 'Toast', text: `Bodo left a box at the delivery bay: ${def.name}` });
  }
}

/** Places an order. Returns why it could not be placed, or null when it was. Used by the desk and by auto-reorder. */
export function buyOrder(state: GameState, orderId: string, events: SimEvent[], quiet = false): string | null {
  if (!isKnownOrder(orderId)) return 'Unknown order';
  const def = ORDERS[orderId];
  const why = orderBlocker(state, def.price);
  if (why) return why;
  state.funds -= def.price;
  const order = { id: `o${state.nextId++}`, orderId, ticksLeft: deliveryTicks() };
  state.orders.push(order);
  state.stats.ordersPlaced += 1;
  rollOrderFailures(state, order, events);
  events.push({ type: 'Purchase', what: def.name });
  events.push({ type: 'Toast', text: quiet ? `Auto-reorder: ${def.name}` : `Ordered: ${def.name}. It arrives in 30 s` });
  return null;
}

export function deliveryTicks(): number {
  return secondsToTicks(DELIVERY_SEC);
}
