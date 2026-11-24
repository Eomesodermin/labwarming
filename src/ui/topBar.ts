import type { GameHost } from '../host';
import { BUILD_ID } from '../platform/buildInfo';
import { formatClock, goalProgress, unreadCount } from '../sim/selectors';
import { canvasUrl } from '../view/art/pixelmap';
import { spriteCanvas } from '../view/art/spriteRegistry';
import { sound } from '../view/audio/sound';
import { ringSvg } from './labPanel';

interface SpeedButton {
  el: HTMLButtonElement;
  speed: 0 | 1 | 2;
}

/** The top bar: day and time, pause and speed. Refreshes four times a second and on speed changes. */
export function mountTopBar(
  root: HTMLElement,
  host: GameHost,
  actions: { note: () => void; inbox: () => void; settings: () => void; build: () => void; staff: () => void; lab: () => void },
): void {
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
      <button type="button" class="btn" data-action="build" title="Build mode (B)">Build</button>
      <button type="button" class="btn" data-action="lab" title="Lab Warming list and Media Kitchen (L)"><span data-role="ring"></span>Goals <span data-role="goalcount">0/5</span></button>
      <button type="button" class="btn" data-action="staff" title="Staff (T)">Staff</button>
      <button type="button" class="btn" data-action="note" title="Leave a note (F)">Note</button>
      <button type="button" class="btn" data-action="inbox" title="Inbox (I)">Inbox<span class="badge" data-role="badge" hidden>0</span></button>
      <button type="button" class="btn" data-action="settings" title="Settings and saves">Settings</button>
      <button type="button" class="btn btn--icon" data-action="sound" title="Sound on or off (M)" aria-label="Sound" aria-pressed="true"><img class="pixicon" alt="" width="16" height="16" /></button>
      <span class="topbar__sep"></span>
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

  const badge = q('badge');
  const ringEl = q('ring');
  const goalCount = q('goalcount');
  let ringLast = '';
  const soundBtn = bar.querySelector<HTMLButtonElement>('button[data-action="sound"]') as HTMLButtonElement;
  const soundImg = soundBtn.querySelector('img') as HTMLImageElement;
  const refreshSound = (): void => {
    const off = sound.isMuted();
    soundImg.src = canvasUrl(spriteCanvas(off ? 'icon.speaker_off' : 'icon.speaker_on'));
    soundBtn.setAttribute('aria-pressed', String(!off));
    soundBtn.title = off ? 'Sound is off. Click or press M to turn it on' : 'Sound is on. Click or press M to turn it off';
  };
  sound.onChange(refreshSound);
  refreshSound();
  soundBtn.addEventListener('click', () => {
    soundBtn.blur();
    sound.setMuted(!sound.isMuted());
    if (!sound.isMuted()) sound.play('ding');
  });
  for (const name of ['build', 'lab', 'staff', 'note', 'inbox', 'settings'] as const) {
    bar.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`)?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      actions[name]();
    });
  }

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
    const gp = goalProgress(s);
    const ringKey = `${gp.done}/${gp.total}`;
    if (ringKey !== ringLast) {
      ringLast = ringKey;
      ringEl.innerHTML = ringSvg(gp.done, gp.total, 16);
      goalCount.textContent = ringKey;
    }
    const unread = unreadCount(s);
    badge.hidden = unread === 0;
    badge.textContent = String(unread);
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
    if (e.type === 'SpeedChanged' || e.type === 'DayEnded' || e.type === 'EmailReceived' || e.type === 'GoalReached') refresh();
  });
}
