// Things that can be ordered at any desk (design doc 4.3). A box arrives at the delivery bay.

import type { StockItem } from './items';

export type OrderId = 'assayKitBox' | 'mediaPowderBox' | 'flaskBox';

export interface OrderDef {
  id: OrderId;
  name: string;
  price: number;
  item: StockItem;
  qty: number;
}

export const ORDERS: Record<OrderId, OrderDef> = {
  assayKitBox: { id: 'assayKitBox', name: 'Assay kit box', price: 40, item: 'assayKits', qty: 4 },
  mediaPowderBox: { id: 'mediaPowderBox', name: 'Media powder box', price: 30, item: 'mediaPowder', qty: 4 },
  flaskBox: { id: 'flaskBox', name: 'Flask box', price: 30, item: 'cleanFlasks', qty: 6 },
};

export const ORDER_IDS: readonly OrderId[] = ['assayKitBox', 'mediaPowderBox', 'flaskBox'];

/** Seconds from ordering to the box appearing at the delivery bay. */
export const DELIVERY_SEC = 30;

export function isKnownOrder(id: string): id is OrderId {
  return Object.prototype.hasOwnProperty.call(ORDERS, id);
}
