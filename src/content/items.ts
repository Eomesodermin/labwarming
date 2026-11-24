// Stock: what the building holds and where it is stored (design doc 4.3 and 5.2).

export interface Stock {
  cleanFlasks: number;
  dirtyFlasks: number;
  media: number;
  assayKits: number;
  mediaPowder: number;
}

export type StockItem = keyof Stock;

export const START_STOCK: Stock = { cleanFlasks: 6, dirtyFlasks: 0, media: 3, assayKits: 4, mediaPowder: 1 };

/** Cold items live in fridges, dry items on shelves. Dirty flasks pile up by the sink with no limit. */
export const COLD_ITEMS: readonly StockItem[] = ['media', 'assayKits'];
export const DRY_ITEMS: readonly StockItem[] = ['cleanFlasks', 'mediaPowder'];

export const ITEM_NAMES: Record<StockItem, string> = {
  cleanFlasks: 'Clean flasks',
  dirtyFlasks: 'Dirty flasks',
  media: 'Media',
  assayKits: 'Assay kits',
  mediaPowder: 'Media powder',
};
