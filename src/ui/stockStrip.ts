import type { GameHost } from '../host';
import { coldCapacity, coldUsed, dryCapacity, dryUsed } from '../sim/stock';
import { roomOfPlayer } from '../sim/selectors';

interface Cell {
  label: string;
  title: string;
  value: () => string;
  warn?: () => boolean;
}

/** The stock strip under the top bar: Data, flasks, media, kits, powder, storage and room Cleanliness. */
export function mountStockStrip(root: HTMLElement, host: GameHost): void {
  const strip = document.createElement('div');
  strip.className = 'stockstrip';
  strip.setAttribute('aria-label', 'Stock');
  root.appendChild(strip);
  const s = (): typeof host.state => host.state;
  const paperText = (): string => {
    const done = s().papers.filter((p) => p.status === 'accepted').length;
    const open = s().papers.length - done;
    return open > 0 ? `${done} (+${open})` : String(done);
  };
  const cells: Cell[] = [
    { label: 'Funds', title: 'Funds. Core funding arrives at the end of each day', value: () => String(s().funds), warn: () => s().funds < 0 },
    { label: 'Rep', title: 'Reputation', value: () => String(s().reputation) },
    { label: 'Papers', title: 'Accepted papers, and papers in review', value: () => paperText() },
    { label: 'Data', title: 'Data from experiments', value: () => String(s().data) },
    { label: 'Clean', title: 'Clean flasks on the shelf', value: () => String(s().stock.cleanFlasks), warn: () => s().stock.cleanFlasks === 0 },
    { label: 'Dirty', title: 'Dirty flasks by the sink', value: () => String(s().stock.dirtyFlasks) },
    { label: 'Media', title: 'Media bottles in the fridge', value: () => String(s().stock.media), warn: () => s().stock.media === 0 },
    { label: 'Kits', title: 'Assay kits in the fridge', value: () => String(s().stock.assayKits), warn: () => s().stock.assayKits === 0 },
    { label: 'Powder', title: 'Media powder on the shelf', value: () => String(s().stock.mediaPowder) },
    { label: 'Cold', title: 'Fridge space used', value: () => `${coldUsed(s())}/${coldCapacity(s())}`, warn: () => coldUsed(s()) >= coldCapacity(s()) },
    { label: 'Dry', title: 'Shelf space used', value: () => `${dryUsed(s())}/${dryCapacity(s())}`, warn: () => dryUsed(s()) >= dryCapacity(s()) },
    {
      label: 'Room',
      title: 'Cleanliness of the room you are in',
      value: () => {
        const r = roomOfPlayer(s());
        return r ? `${Math.round(r.cleanliness)}%` : '-';
      },
      warn: () => (roomOfPlayer(s())?.cleanliness ?? 100) < 50,
    },
  ];
  const els = cells.map((c) => {
    const el = document.createElement('span');
    el.className = 'stat';
    el.title = c.title;
    el.innerHTML = `<span class="stat__label">${c.label}</span> <b class="stat__value"></b>`;
    strip.appendChild(el);
    return el.querySelector<HTMLElement>('.stat__value') as HTMLElement;
  });
  const refresh = (): void => {
    cells.forEach((c, i) => {
      const el = els[i] as HTMLElement;
      const v = c.value();
      if (el.textContent !== v) el.textContent = v;
      el.parentElement?.classList.toggle('stat--warn', c.warn?.() === true);
    });
  };
  refresh();
  setInterval(refresh, 150);
}
