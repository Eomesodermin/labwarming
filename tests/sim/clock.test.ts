import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../../src/content/balance';
import { createInitialState } from '../../src/sim/createState';
import { clockTime, formatClock } from '../../src/sim/selectors';
import { step } from '../../src/sim/step';

describe('clock', () => {
  it('starts on day 1 at 08:00', () => {
    const s = createInitialState(1);
    expect(s.clock.day).toBe(1);
    expect(formatClock(s)).toBe('08:00');
  });

  it('advances one tick per step', () => {
    const s = createInitialState(1);
    step(s, []);
    expect(s.tick).toBe(1);
    expect(s.clock.tickOfDay).toBe(1);
  });

  it('maps ticks to time: 240 ticks is one game hour', () => {
    const s = createInitialState(1);
    s.clock.tickOfDay = 240;
    expect(clockTime(s)).toEqual({ hour: 9, minute: 0 });
    s.clock.tickOfDay = 600;
    expect(clockTime(s)).toEqual({ hour: 10, minute: 30 });
    s.clock.tickOfDay = TICKS_PER_DAY - 1;
    expect(clockTime(s)).toEqual({ hour: 17, minute: 59 });
  });

  it('rolls over to the next day at 08:00 and reports it', () => {
    const s = createInitialState(1);
    let ended = 0;
    for (let i = 0; i < TICKS_PER_DAY; i++) {
      ended += step(s, []).filter((e) => e.type === 'DayEnded').length;
    }
    expect(ended).toBe(1);
    expect(s.clock.day).toBe(2);
    expect(formatClock(s)).toBe('08:00');
  });

  it('pause stops time, resume restores the previous speed', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'SetSpeed', speed: 2 }]);
    expect(s.clock.speed).toBe(2);
    step(s, [{ type: 'TogglePause' }]);
    expect(s.clock.speed).toBe(0);
    const t = s.tick;
    step(s, []);
    step(s, []);
    expect(s.tick).toBe(t);
    step(s, [{ type: 'TogglePause' }]);
    expect(s.clock.speed).toBe(2);
    expect(s.tick).toBe(t + 1);
  });

  it('can change speed while paused without advancing', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'SetSpeed', speed: 0 }]);
    const t = s.tick;
    step(s, [{ type: 'SetSpeed', speed: 1 }]);
    expect(s.clock.speed).toBe(1);
    expect(s.tick).toBe(t + 1);
  });
});
