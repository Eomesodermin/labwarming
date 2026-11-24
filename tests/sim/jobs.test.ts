import { describe, expect, it } from 'vitest';
import { PLAYER_ID } from '../../src/sim/commands';
import { step } from '../../src/sim/step';
import { doJob, equip, newGame, rejections, run, stand } from './helpers';

/** Makes a ready culture without waiting. */
function addReadyCulture(state: ReturnType<typeof newGame>): void {
  const inc = equip(state, 'incubator');
  state.cultures.push({ id: `c${state.nextId++}`, incubatorId: inc.id, growTicksLeft: 0, status: 'ready' });
}

describe('split cells', () => {
  it('takes 10 s, uses a flask and media, and puts a culture in the incubator', () => {
    const s = newGame();
    stand(s, 'hood');
    step(s, [{ type: 'Interact' }]);
    const job = s.jobs[s.agents[PLAYER_ID]?.jobId ?? ''];
    expect(job?.totalTicks).toBe(100);
    run(s, 98);
    expect(s.cultures).toHaveLength(0);
    run(s, 3);
    expect(s.cultures).toHaveLength(1);
    expect(s.stock.cleanFlasks).toBe(5);
    expect(s.stock.media).toBe(2);
    expect(s.cultures[0]?.status).toBe('growing');
    expect(s.cultures[0]?.growTicksLeft).toBeLessThanOrEqual(450);
  });

  it('refuses with a reason when an input is missing', () => {
    const s = newGame();
    s.stock.media = 0;
    stand(s, 'hood');
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['Needs 1 media']);
    s.stock.media = 3;
    s.stock.cleanFlasks = 0;
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['Needs 1 clean flask']);
  });

  it('refuses when both incubator slots are full', () => {
    const s = newGame();
    addReadyCulture(s);
    addReadyCulture(s);
    stand(s, 'hood');
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['Needs a free incubator slot']);
  });

  it('grows a culture in 45 s and then marks it ready', () => {
    const s = newGame();
    doJob(s, 'hood');
    expect(s.cultures).toHaveLength(1);
    const left = s.cultures[0]?.growTicksLeft ?? 0;
    run(s, left - 1);
    expect(s.cultures[0]?.status).toBe('growing');
    run(s, 1);
    expect(s.cultures[0]?.status).toBe('ready');
    expect(s.stats.culturesGrown).toBe(1);
  });
});

describe('sweet spot', () => {
  it('a press inside the green zone gives the bonus and a press outside gives nothing', () => {
    const s = newGame();
    addReadyCulture(s);
    stand(s, 'bench');
    step(s, [{ type: 'Interact' }]);
    const job = Object.values(s.jobs)[0];
    expect(job).toBeDefined();
    if (!job) return;
    run(s, job.sweetStart + 2);
    const ev = step(s, [{ type: 'Interact' }]);
    expect(ev).toContainEqual({ type: 'SweetSpot', stationId: equip(s, 'bench').id, hit: true });
    run(s, job.totalTicks);
    expect(s.data).toBe(12);
  });

  it('a press at the very start misses, costs nothing and cannot be repeated', () => {
    const s = newGame();
    addReadyCulture(s);
    stand(s, 'bench');
    step(s, [{ type: 'Interact' }]);
    const ev = step(s, [{ type: 'Interact' }]);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'SweetSpot', hit: false }));
    const job = Object.values(s.jobs)[0];
    if (!job) throw new Error('no job');
    run(s, job.sweetStart + 2); // press again inside the zone: ignored
    expect(step(s, [{ type: 'Interact' }]).filter((e) => e.type === 'SweetSpot')).toHaveLength(0);
    run(s, job.totalTicks);
    expect(s.data).toBe(10);
  });

  it('on split cells it makes the culture grow 10 s faster', () => {
    const normal = newGame();
    doJob(normal, 'hood');
    const fast = newGame();
    stand(fast, 'hood');
    step(fast, [{ type: 'Interact' }]);
    const job = Object.values(fast.jobs)[0];
    if (!job) throw new Error('no job');
    run(fast, job.sweetStart + 2);
    step(fast, [{ type: 'SweetSpotPress' }]);
    run(fast, job.totalTicks);
    const a = normal.cultures[0]?.growTicksLeft ?? 0;
    const b = fast.cultures[0]?.growTicksLeft ?? 0;
    // Both started growing at about the same time, so compare against the full time.
    expect(450 - a).toBeLessThanOrEqual(5);
    expect(b).toBeLessThanOrEqual(350);
  });

  it('on wash flask makes the next flask take half the time', () => {
    const s = newGame();
    s.stock.dirtyFlasks = 3;
    stand(s, 'sink');
    step(s, [{ type: 'Interact' }]);
    const first = Object.values(s.jobs)[0];
    if (!first) throw new Error('no job');
    expect(first.totalTicks).toBe(50);
    run(s, first.sweetStart + 2);
    step(s, [{ type: 'SweetSpotPress' }]);
    run(s, first.totalTicks);
    expect(s.stock.dirtyFlasks).toBe(2);
    step(s, [{ type: 'Interact' }]);
    expect(Object.values(s.jobs)[0]?.totalTicks).toBe(25);
  });

  it('on tidy up adds 10 Cleanliness', () => {
    const s = newGame();
    const plot = s.plots['a'];
    if (!plot) throw new Error('no plot');
    plot.cleanliness = 30;
    stand(s, 'spray');
    step(s, [{ type: 'Interact' }]);
    const job = Object.values(s.jobs)[0];
    if (!job) throw new Error('no job');
    run(s, job.sweetStart + 2);
    step(s, [{ type: 'SweetSpotPress' }]);
    run(s, job.totalTicks);
    expect(plot.cleanliness).toBe(80);
  });
});

describe('run experiment', () => {
  it('uses the culture and a kit, adds 10 Data, a dirty flask and a waste bag', () => {
    const s = newGame();
    addReadyCulture(s);
    const ev = doJob(s, 'bench');
    expect(ev).toContainEqual(expect.objectContaining({ type: 'JobCompleted', defId: 'runExperiment' }));
    expect(s.data).toBe(10);
    expect(s.stock.assayKits).toBe(3);
    expect(s.stock.dirtyFlasks).toBe(1);
    expect(s.plots['a']?.waste).toBe(1);
    expect(s.cultures).toHaveLength(0);
    expect(s.stats.experiments).toBe(1);
  });

  it('needs a ready culture, not a growing one', () => {
    const s = newGame();
    doJob(s, 'hood');
    stand(s, 'bench');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'runExperiment' }]))).toEqual(['Needs 1 ready culture']);
  });

  it('is refused once the bin holds 8 waste, with a clear message', () => {
    const s = newGame();
    s.stock.assayKits = 20;
    s.stock.dirtyFlasks = 0;
    for (let i = 0; i < 8; i++) {
      addReadyCulture(s);
      doJob(s, 'bench', 'runExperiment');
    }
    expect(s.stats.experiments).toBe(8);
    expect(s.plots['a']?.waste).toBe(8);
    addReadyCulture(s);
    stand(s, 'bench');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'runExperiment' }]))).toEqual([
      'The waste bin is full. Take it out first',
    ]);
  });
});

describe('wash, media, waste, tidy, bin', () => {
  it('washes a dirty flask into a clean one', () => {
    const s = newGame();
    s.stock.dirtyFlasks = 1;
    doJob(s, 'sink');
    expect(s.stock.dirtyFlasks).toBe(0);
    expect(s.stock.cleanFlasks).toBe(7);
  });

  it('makes 3 media from 1 powder when the fridge has room', () => {
    const s = newGame();
    s.stock.media = 0; // cold 4 of 8
    doJob(s, 'bench', 'makeMedia');
    expect(s.stock.media).toBe(3);
    expect(s.stock.mediaPowder).toBe(0);
  });

  it('refuses to make media into a full fridge', () => {
    const s = newGame(); // cold 7 of 8
    stand(s, 'bench');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'makeMedia' }]))[0]).toMatch(/free spaces in the fridge/);
  });

  it('takes out waste', () => {
    const s = newGame();
    const plot = s.plots['a'];
    if (!plot) throw new Error('no plot');
    plot.waste = 5;
    doJob(s, 'bin');
    expect(plot.waste).toBe(0);
    expect(s.stats.wasteTaken).toBe(1);
  });

  it('says the bin is empty when there is nothing to take', () => {
    const s = newGame();
    stand(s, 'bin');
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['The bin is empty']);
  });

  it('tidy up needs Cleanliness below 80 and adds 40', () => {
    const s = newGame();
    stand(s, 'spray');
    expect(rejections(step(s, [{ type: 'Interact' }]))).toEqual(['Already tidy']);
    const plot = s.plots['a'];
    if (!plot) throw new Error('no plot');
    plot.cleanliness = 50;
    doJob(s, 'spray');
    expect(plot.cleanliness).toBe(90);
  });

  it('bins a contaminated culture into a dirty flask and waste', () => {
    const s = newGame();
    const inc = equip(s, 'incubator');
    s.cultures.push({ id: 'cx', incubatorId: inc.id, growTicksLeft: 0, status: 'contaminated' });
    doJob(s, 'incubator');
    expect(s.cultures).toHaveLength(0);
    expect(s.stock.dirtyFlasks).toBe(1);
    expect(s.plots['a']?.waste).toBe(1);
  });
});

describe('walking away', () => {
  it('pauses the job and keeps its progress, and coming back resumes it', () => {
    const s = newGame();
    stand(s, 'hood');
    step(s, [{ type: 'Interact' }]);
    run(s, 30);
    const job = Object.values(s.jobs)[0];
    if (!job) throw new Error('no job');
    const before = job.progressTicks;
    expect(before).toBeGreaterThan(20);
    // Walk away two tiles and wait.
    step(s, [{ type: 'SetPlayerTarget', x: 3, y: 5 }]);
    run(s, 60);
    expect(job.progressTicks).toBeLessThanOrEqual(before + 1);
    const paused = job.progressTicks;
    run(s, 40);
    expect(job.progressTicks).toBe(paused);
    expect(s.cultures).toHaveLength(0);
    // Come back by clicking the station: the job resumes from where it was.
    const hood = equip(s, 'hood');
    step(s, [{ type: 'SetPlayerTarget', x: hood.x, y: hood.y, stationId: hood.id }]);
    run(s, 80);
    expect(s.cultures).toHaveLength(1);
    expect(Object.keys(s.jobs)).toHaveLength(0);
  });

  it('a click on a station walks there and starts the job', () => {
    const s = newGame();
    const hood = equip(s, 'hood');
    step(s, [{ type: 'SetPlayerTarget', x: hood.x, y: hood.y, stationId: hood.id }]);
    run(s, 60);
    expect(s.agents[PLAYER_ID]?.jobId).not.toBeNull();
    run(s, 120);
    expect(s.cultures).toHaveLength(1);
  });

  it('Esc stops the job but keeps its progress', () => {
    const s = newGame();
    stand(s, 'hood');
    step(s, [{ type: 'Interact' }]);
    run(s, 20);
    step(s, [{ type: 'CancelJob' }]);
    const job = Object.values(s.jobs)[0];
    const p = job?.progressTicks ?? 0;
    run(s, 50);
    expect(job?.progressTicks).toBe(p);
    step(s, [{ type: 'Interact' }]);
    expect(s.agents[PLAYER_ID]?.jobId).toBe(job?.id);
  });
});

describe('cleanliness', () => {
  it('each finished job costs the room 2 points, and tidy up does not', () => {
    const s = newGame();
    s.stock.dirtyFlasks = 2;
    doJob(s, 'sink');
    doJob(s, 'sink');
    expect(s.plots['a']?.cleanliness).toBe(96);
    const plot = s.plots['a'];
    if (!plot) throw new Error('no plot');
    plot.cleanliness = 70;
    doJob(s, 'spray');
    expect(plot.cleanliness).toBe(100);
  });
});

describe('determinism', () => {
  it('the same seed and the same job script give the same state', () => {
    const play = (): string => {
      const s = newGame(99);
      for (let i = 0; i < 3; i++) {
        doJob(s, 'hood');
      }
      run(s, 1200);
      s.stock.assayKits = 9;
      for (let i = 0; i < 2; i++) doJob(s, 'bench', 'runExperiment');
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });
});
