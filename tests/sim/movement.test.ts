import { describe, expect, it } from 'vitest';
import { PLAYER_MOVE_SPEED } from '../../src/content/balance';
import type { Command } from '../../src/sim/commands';
import { createInitialState } from '../../src/sim/createState';
import { getPlayer } from '../../src/sim/selectors';
import { step } from '../../src/sim/step';
import type { GameState } from '../../src/sim/types';

function run(s: GameState, ticks: number, cmds: Command[] = []): void {
  step(s, cmds);
  for (let i = 1; i < ticks; i++) step(s, []);
}

describe('movement', () => {
  it('walks one tile per press', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'MovePlayer', dir: 'right' }]);
    run(s, 6);
    const p = getPlayer(s);
    expect(p).toMatchObject({ x: 6, y: 5, facing: 'right' });
    expect(p.path).toEqual([]);
  });

  it('takes 100 / speed ticks per tile, so 4 tiles per second for the player', () => {
    const s = createInitialState(1);
    expect(PLAYER_MOVE_SPEED).toBe(40);
    step(s, [{ type: 'MovePlayer', dir: 'down' }]);
    expect(getPlayer(s).y).toBe(5);
    step(s, []);
    expect(getPlayer(s).y).toBe(5);
    step(s, []); // third tick: 120 progress
    expect(getPlayer(s).y).toBe(6);
  });

  it('keeps walking without pauses while a key is held', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 20; i++) step(s, [{ type: 'MovePlayer', dir: 'left' }]);
    // 20 ticks at 40 per tick is 800 progress: 8 tiles, but the Lab wall stops it at x = 2.
    expect(getPlayer(s).x).toBe(2);
    const s2 = createInitialState(1);
    for (let i = 0; i < 10; i++) step(s2, [{ type: 'MovePlayer', dir: 'down' }]);
    expect(getPlayer(s2).y).toBe(5 + 4);
  });

  it('turns without moving when blocked by a wall', () => {
    const s = createInitialState(1);
    s.agents['player'] = { ...getPlayer(s), x: 2, y: 5 };
    step(s, [{ type: 'MovePlayer', dir: 'left' }]);
    run(s, 5);
    expect(getPlayer(s)).toMatchObject({ x: 2, y: 5, facing: 'left' });
  });

  it('cannot walk through equipment', () => {
    const s = createInitialState(1);
    s.agents['player'] = { ...getPlayer(s), x: 5, y: 3 };
    step(s, [{ type: 'MovePlayer', dir: 'up' }]); // the bench is at (5,2)
    run(s, 5);
    expect(getPlayer(s)).toMatchObject({ x: 5, y: 3, facing: 'up' });
  });

  it('walks through the door into the corridor', () => {
    const s = createInitialState(1);
    s.agents['player'] = { ...getPlayer(s), x: 5, y: 7 };
    for (let i = 0; i < 12; i++) step(s, [{ type: 'MovePlayer', dir: 'down' }]);
    const p = getPlayer(s);
    expect(p.x).toBe(5);
    expect(p.y).toBeGreaterThanOrEqual(9);
  });

  it('cannot enter a plot that is for sale', () => {
    const s = createInitialState(1);
    s.agents['player'] = { ...getPlayer(s), x: 14, y: 9 };
    for (let i = 0; i < 12; i++) step(s, [{ type: 'MovePlayer', dir: 'up' }]);
    expect(getPlayer(s)).toMatchObject({ x: 14, y: 9 });
  });

  it('follows a click target around obstacles', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'SetPlayerTarget', x: 25, y: 10 }]);
    expect(getPlayer(s).path.length).toBeGreaterThan(20);
    run(s, 200);
    expect(getPlayer(s)).toMatchObject({ x: 25, y: 10, path: [] });
  });

  it('rejects an unreachable click target and keeps the player where they are', () => {
    const s = createInitialState(1);
    const events = step(s, [{ type: 'SetPlayerTarget', x: 12, y: 4 }]);
    expect(events).toEqual([{ type: 'CommandRejected', reason: 'No way to get there' }]);
    expect(getPlayer(s).path).toEqual([]);
  });

  it('walks to the front of a station and faces it', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'SetPlayerTarget', x: 6, y: 2 }]); // the bench
    run(s, 60);
    const p = getPlayer(s);
    expect(p.y).toBe(3);
    expect([5, 6]).toContain(p.x);
    expect(p.facing).toBe('up');
  });

  it('lets a new click redirect mid-walk without teleporting', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'SetPlayerTarget', x: 8, y: 5 }]); // progress 40 towards (6,5)
    step(s, [{ type: 'SetPlayerTarget', x: 3, y: 5 }]); // progress 80
    const p = getPlayer(s);
    expect(p.x).toBe(5);
    expect(p.path[0]).toEqual({ x: 6, y: 5 }); // finishes the step in progress first
    run(s, 80);
    expect(getPlayer(s)).toMatchObject({ x: 3, y: 5 });
  });

  it('does not move while paused', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'MovePlayer', dir: 'right' }]);
    step(s, [{ type: 'TogglePause' }]);
    const before = JSON.stringify(s.agents);
    for (let i = 0; i < 20; i++) step(s, []);
    expect(JSON.stringify(s.agents)).toBe(before);
    const events = step(s, [{ type: 'MovePlayer', dir: 'down' }]);
    expect(events).toEqual([{ type: 'CommandRejected', reason: 'Paused' }]);
  });

  it('stops safely if the way is blocked mid-path', () => {
    const s = createInitialState(1);
    step(s, [{ type: 'SetPlayerTarget', x: 8, y: 5 }]);
    s.equipment['block'] = { id: 'block', defId: 'sink', tier: 1, x: 7, y: 5, rot: 0, broken: false, cycle: null };
    s.gridVersion += 1;
    run(s, 40);
    const p = getPlayer(s);
    expect(p.path).toEqual([]);
    expect(p.x).toBe(6);
  });
});
