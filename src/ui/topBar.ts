import type { GameHost } from '../host';
import { BUILD_ID } from '../platform/buildInfo';
import { formatClock } from '../sim/selectors';

interface SpeedButton {
  el: HTMLButtonElement;
  speed: 0 | 1 | 2;
}

/** The top bar: day and time, pause and speed. Refreshes four times a second and on speed changes. */
export function mountTopBar(root: HTMLElement, host: GameHost): void {
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML = `
    <div class="topbar__left">
      <span class="topbar__title">Labwarming</span>
      <span class="chip" data-role="day">Day 1</span>
      <span class="chip chip--time" data-role="time">08:00</span>
      <span class="chip chip--paused" data-role="paused" hidden>Paused</span>
    </div>
    <div class="topbar__right" role="group" aria-label="Time controls">
      <button type="button" class="btn" data-speed="0" title="Pause or resume (P)">Pause</button>
      <button type="button" class="btn" data-speed="1" title="Normal speed (1)">1x</button>
      <button type="button" class="btn" data-speed="2" title="Double speed (2)">2x</button>
      <span class="topbar__build" title="Build id">${BUILD_ID}</span>
    </div>`;
  root.appendChild(bar);

  const q = <T extends HTMLElement>(role: string): T => bar.querySelector(`[data-role="${role}"]`) as T;
  const day = q('day');
  const time = q('time');
  const paused = q('paused');
  const buttons: SpeedButton[] = [...bar.querySelectorAll<HTMLButtonElement>('button[data-speed]')].map((el) => ({
    el,
    speed: Number(el.dataset['speed']) as 0 | 1 | 2,
  }));

  for (const b of buttons) {
    b.el.addEventListener('click', () => {
      if (b.speed === 0) host.send({ type: 'TogglePause' });
      else host.send({ type: 'SetSpeed', speed: b.speed });
      b.el.blur(); // keep keyboard shortcuts working
    });
  }

  const refresh = (): void => {
    const s = host.state;
    day.textContent = `Day ${s.clock.day}`;
    time.textContent = formatClock(s);
    paused.hidden = s.clock.speed !== 0;
    for (const b of buttons) {
      const active = b.speed === 0 ? s.clock.speed === 0 : s.clock.speed === b.speed;
      b.el.setAttribute('aria-pressed', String(active));
      b.el.classList.toggle('btn--active', active);
      if (b.speed === 0) b.el.textContent = s.clock.speed === 0 ? 'Resume' : 'Pause';
    }
  };

  refresh();
  setInterval(refresh, 250);
  host.events.on((e) => {
    if (e.type === 'SpeedChanged' || e.type === 'DayEnded') refresh();
  });
}
