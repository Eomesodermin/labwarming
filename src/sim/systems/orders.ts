import { DELIVERY_SEC } from '../../content/orders';
import { ORDERS, isKnownOrder } from '../../content/orders';
import { secondsToTicks } from '../ticks';
import type { SimEvent } from '../simEvents';
import type { GameState } from '../types';

/** Orders count down. When one arrives, its box waits at the delivery bay. */
export function ordersSystem(state: GameState, events: SimEvent[]): void {
  if (state.orders.length === 0) return;
  const arrived: string[] = [];
  for (const o of state.orders) {
    o.ticksLeft -= 1;
    if (o.ticksLeft <= 0) arrived.push(o.id);
  }
  if (arrived.length === 0) return;
  for (const id of arrived) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) continue;
    state.orders = state.orders.filter((x) => x.id !== id);
    const def = isKnownOrder(o.orderId) ? ORDERS[o.orderId] : undefined;
    if (!def) continue;
    const box = { id: `b${state.nextId++}`, orderId: def.id, qty: def.qty };
    state.boxes.push(box);
    events.push({ type: 'BoxDelivered', boxId: box.id });
    events.push({ type: 'Toast', text: `Bodo left a box at the delivery bay: ${def.name}` });
  }
}

export function deliveryTicks(): number {
  return secondsToTicks(DELIVERY_SEC);
}
