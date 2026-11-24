import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/sim/commands';
import { createInitialState } from '../../src/sim/createState';
import { step } from '../../src/sim/step';
import type { GameState } from '../../src/sim/types';

/** A fixed script of commands by tick. */
function script(tick: number): Command[] {
  if (tick === 0) return [{ type: 'SetPlayerTarget', x: 25, y: 10 }];
  if (tick === 400) return [{ type: 'SetSpeed', speed: 2 }];
  if (tick === 410) return [{ type: 'SetPlayerTarget', x: 6, y: 5 }];
  if (tick === 900) return [{ type: 'TogglePause' }];
  if (tick === 910) return [{ type: 'TogglePause' }];
  if (tick >= 1500 && tick < 1520) return [{ type: 'MovePlayer', dir: 'up' }];
  if (tick === 3000) return [{ type: 'SetPlayerTarget', x: 8, y: 4 }];
  return [];
}

function play(seed: number, ticks: number): GameState {
  const s = createInitialState(seed);
  for (let t = 0; t < ticks; t++) step(s, script(t));
  return s;
}

describe('step', () => {
  it('is deterministic: same seed and commands give the same state after 5000 ticks', () => {
    const a = JSON.stringify(play(1234, 5000));
    const b = JSON.stringify(play(1234, 5000));
    expect(a).toBe(b);
  });

  it('keeps the seed in the state, so seeds can differ', () => {
    expect(JSON.stringify(play(1, 100))).not.toBe(JSON.stringify(play(2, 100)));
  });

  it('keeps state plain JSON: it survives a round trip', () => {
    const s = play(5, 1500);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('advances exactly one tick per call', () => {
    const s = createInitialState(1);
    step(s, []);
    step(s, []);
    step(s, []);
    expect(s.tick).toBe(3);
  });

  it('still handles commands while paused, without advancing the tick', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'TogglePause' }]);
    expect(s.tick).toBe(0);
    const ev = step(s, [{ type: 'SetSpeed', speed: 1 }]);
    expect(ev).toEqual([{ type: 'SpeedChanged', speed: 1 }]);
    expect(s.tick).toBe(1);
  });

  it('starts with the Lab furnished and the player inside', () => {
    const s = createInitialState(1);
    expect(Object.values(s.equipment).map((e) => e.defId).sort()).toEqual(
      ['bay', 'bench', 'bin', 'desk', 'fridge', 'hood', 'incubator', 'shelf', 'sink', 'spray'].sort(),
    );
    expect(s.plots['a']?.owned).toBe(true);
    expect(s.plots['b']?.owned).toBe(false);
  });
});
