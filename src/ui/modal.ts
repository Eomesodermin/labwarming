import type { GameHost } from '../host';
import { button, el } from './dom';

export interface ModalHandle {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
}

export interface ModalOptions {
  title: string;
  wide?: boolean;
  /** Pause the game while the panel is open (the default). */
  pause?: boolean;
  /** Shows an X button and closes on Esc (the default). */
  dismissable?: boolean;
  onClose?: () => void;
}

/** Pauses the game until the returned function is called. Several holds share one pause. */
export function holdPause(host: GameHost): () => void {
  const ui = host.ui;
  ui.pauseHolds += 1;
  if (ui.pauseHolds === 1 && host.state.clock.speed !== 0) {
    ui.restoreSpeed = host.state.clock.speed;
    host.send({ type: 'SetSpeed', speed: 0 });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    ui.pauseHolds = Math.max(0, ui.pauseHolds - 1);
    if (ui.pauseHolds === 0 && ui.restoreSpeed !== null) {
      host.send({ type: 'SetSpeed', speed: ui.restoreSpeed });
      ui.restoreSpeed = null;
    }
  };
}

let current: ModalHandle | null = null;
const waiting: Array<() => void> = [];

export function modalOpen(): boolean {
  return current !== null;
}

/** Runs `open` now if no panel is open, or as soon as the open one closes. */
export function whenFree(open: () => void): void {
  if (current) waiting.push(open);
  else open();
}

/** Opens a panel over the game. Only one is open at a time: opening another closes the first. */
export function openModal(root: HTMLElement, host: GameHost, opts: ModalOptions): ModalHandle {
  current?.close();
  const back = el('div', 'modal-back');
  const panel = el('div', opts.wide ? 'modal modal--wide' : 'modal');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', opts.title);
  const head = el('div', 'modal__head');
  head.appendChild(el('h2', 'modal__title', ''));
  (head.firstElementChild as HTMLElement).textContent = opts.title;
  const body = el('div', 'modal__body');
  panel.append(head, body);
  back.appendChild(panel);
  root.appendChild(back);

  host.ui.blocking += 1;
  const release = opts.pause === false ? () => undefined : holdPause(host);
  let closed = false;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && opts.dismissable !== false) {
      e.preventDefault();
      handle.close();
    }
  };
  const handle: ModalHandle = {
    el: back,
    body,
    close: () => {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey);
      back.remove();
      host.ui.blocking = Math.max(0, host.ui.blocking - 1);
      release();
      if (current === handle) current = null;
      opts.onClose?.();
      const next = waiting.shift();
      if (next) next();
    },
  };
  if (opts.dismissable !== false) {
    const x = button('Close', 'btn modal__x', () => handle.close());
    x.setAttribute('aria-label', 'Close');
    head.appendChild(x);
  }
  window.addEventListener('keydown', onKey);
  current = handle;
  return handle;
}
