import { storageGet, storageSet } from '../../platform/storage';

/** The sounds the game makes. All of them are generated with the Web Audio API, so there are no sound files. */
export type SoundName = 'step' | 'pop' | 'ding' | 'ping' | 'chaching' | 'place' | 'bottle' | 'knock' | 'goal' | 'party' | 'nope';

const MUTE_KEY = 'labwarming.muted';
const MASTER = 0.5;

interface Tone {
  /** Start frequency in Hz, and the frequency it glides to. */
  f: number;
  to?: number;
  /** Start offset, length and peak volume. */
  at?: number;
  len: number;
  vol: number;
  type?: OscillatorType;
}

/** Each sound is a short list of tones. Small, soft and warm: no harsh edges, nothing longer than a second. */
const RECIPES: Record<SoundName, readonly Tone[]> = {
  step: [{ f: 180, to: 120, len: 0.05, vol: 0.05, type: 'triangle' }],
  pop: [{ f: 380, to: 820, len: 0.09, vol: 0.16, type: 'sine' }],
  ding: [
    { f: 988, len: 0.45, vol: 0.14, type: 'sine' },
    { f: 1976, len: 0.3, vol: 0.05, type: 'sine' },
  ],
  ping: [
    { f: 784, len: 0.16, vol: 0.12, type: 'sine' },
    { f: 1175, at: 0.1, len: 0.3, vol: 0.12, type: 'sine' },
  ],
  chaching: [
    { f: 1568, len: 0.12, vol: 0.1, type: 'triangle' },
    { f: 2093, at: 0.08, len: 0.4, vol: 0.12, type: 'triangle' },
    { f: 4186, at: 0.08, len: 0.2, vol: 0.03, type: 'sine' },
  ],
  place: [
    { f: 160, to: 70, len: 0.13, vol: 0.22, type: 'triangle' },
    { f: 420, to: 260, len: 0.05, vol: 0.06, type: 'sine' },
  ],
  bottle: [
    { f: 2400, len: 0.12, vol: 0.07, type: 'sine' },
    { f: 3150, at: 0.04, len: 0.16, vol: 0.06, type: 'sine' },
    { f: 1700, at: 0.09, len: 0.12, vol: 0.04, type: 'sine' },
  ],
  knock: [
    { f: 130, to: 90, len: 0.08, vol: 0.2, type: 'triangle' },
    { f: 130, to: 90, at: 0.14, len: 0.08, vol: 0.2, type: 'triangle' },
  ],
  goal: [
    { f: 523, len: 0.18, vol: 0.12, type: 'triangle' },
    { f: 659, at: 0.12, len: 0.18, vol: 0.12, type: 'triangle' },
    { f: 784, at: 0.24, len: 0.4, vol: 0.14, type: 'triangle' },
  ],
  party: [
    { f: 523, len: 0.2, vol: 0.12, type: 'triangle' },
    { f: 659, at: 0.14, len: 0.2, vol: 0.12, type: 'triangle' },
    { f: 784, at: 0.28, len: 0.2, vol: 0.12, type: 'triangle' },
    { f: 1047, at: 0.42, len: 0.5, vol: 0.14, type: 'triangle' },
    { f: 2093, at: 0.5, len: 0.35, vol: 0.04, type: 'sine' },
    { f: 1568, at: 0.7, len: 0.4, vol: 0.05, type: 'sine' },
  ],
  nope: [{ f: 200, to: 150, len: 0.14, vol: 0.1, type: 'sine' }],
};

type Ctor = typeof AudioContext;

/** Plays the generated sounds. The audio context is made on the first key press or click, as browsers require. */
class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;
  private lastPlayed = new Map<SoundName, number>();
  private listeners = new Set<() => void>();

  constructor() {
    this.muted = storageGet(MUTE_KEY) === '1';
    const unlock = (): void => {
      this.ensure();
      void this.ctx?.resume();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlock, { once: false, passive: true });
      window.addEventListener('keydown', unlock, { once: false, passive: true });
    }
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
      const Ctx = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(on: boolean): void {
    this.muted = on;
    storageSet(MUTE_KEY, on ? '1' : '0');
    for (const l of this.listeners) l();
  }

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  /** How many sounds have been started since the page opened. Used by tests in the browser. */
  played = 0;

  play(name: SoundName): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
      return;
    }
    // The same sound never stacks closer than 60 ms, so a burst of events stays gentle.
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.06) return;
    this.lastPlayed.set(name, now);
    this.played++;
    for (const t of RECIPES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + (t.at ?? 0);
      osc.type = t.type ?? 'sine';
      osc.frequency.setValueAtTime(t.f, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.len);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(t.vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.len);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + t.len + 0.05);
    }
  }
}

export const sound = new Sound();
