import { TICKS_PER_SECOND } from '../../content/balance';
import { tierStat } from '../../content/equipment';
import { JOBS, TUNING, jobsForStation, type JobDef } from '../../content/jobs';
import { ROT_FACING, equipmentAt, DIR_VECTORS, frontTiles, opposite } from '../grid';
import { nextFloat } from '../rng';
import type { SimEvent } from '../simEvents';
import { addStock, binFull, coldFree, dryFree, plotOf } from '../stock';
import type { Agent, Culture, Equipment, GameState, Job } from '../types';
import { cleanRoom, dirtyRoom } from './cleanliness';
import { incubatorWithFreeSlot } from './cultures';

const PLAYER = 'player';

export function secondsToTicks(s: number): number {
  return Math.max(1, Math.round(s * TICKS_PER_SECOND));
}

/** Seconds a job takes for the player at this station and tier. */
export function jobSeconds(def: JobDef, eq: Equipment): number {
  return def.secondsStat ? tierStat(def.station, def.secondsStat, eq.tier, def.seconds) : def.seconds;
}

/** True when the agent stands on a front tile of the station, still, and looks at it. */
export function atStation(agent: Agent, eq: Equipment): boolean {
  if (agent.path.length > 0) return false;
  if (!frontTiles(eq).some((t) => t.x === agent.x && t.y === agent.y)) return false;
  return agent.facing === opposite(ROT_FACING[eq.rot]);
}

/** The station the agent is looking at, if any. */
export function facedStation(state: GameState, agent: Agent): Equipment | null {
  const v = DIR_VECTORS[agent.facing];
  return equipmentAt(state, agent.x + v.x, agent.y + v.y);
}

/** Why a job cannot be done right now, or null if it can. Checks inputs and room for outputs. */
export function jobBlocker(state: GameState, def: JobDef, eq: Equipment): string | null {
  const s = state.stock;
  const plotId = plotOf(eq);
  switch (def.id) {
    case 'splitCells':
      if (s.cleanFlasks < 1) return 'Needs 1 clean flask';
      if (s.media < 1) return 'Needs 1 media';
      if (!incubatorWithFreeSlot(state)) return 'Needs a free incubator slot';
      return null;
    case 'runExperiment':
      if (!state.cultures.some((c) => c.status === 'ready')) return 'Needs 1 ready culture';
      if (s.assayKits < 1) return 'Needs 1 assay kit';
      if (!plotId || binFull(state, plotId)) return 'The waste bin is full. Take it out first';
      return null;
    case 'makeMedia':
      if (s.mediaPowder < 1) return 'Needs 1 media powder';
      if (coldFree(state) < TUNING.mediaPerPowder) return `Needs ${TUNING.mediaPerPowder} free spaces in the fridge`;
      return null;
    case 'washFlask':
      if (s.dirtyFlasks < 1) return 'Needs 1 dirty flask';
      if (dryFree(state) < 1) return 'The shelf is full';
      return null;
    case 'takeOutWaste':
      if (!plotId || (state.plots[plotId]?.waste ?? 0) < 1) return 'The bin is empty';
      return null;
    case 'tidyUp':
      if (!plotId || (state.plots[plotId]?.cleanliness ?? 100) >= TUNING.tidyBelow) return 'Already tidy';
      return null;
    case 'binCulture':
      if (!state.cultures.some((c) => c.incubatorId === eq.id && c.status === 'contaminated')) return 'No contaminated culture here';
      if (!plotId || binFull(state, plotId)) return 'The waste bin is full. Take it out first';
      return null;
  }
}

function findJob(state: GameState, workerId: string, stationId: string, defId: string): Job | undefined {
  return Object.values(state.jobs).find((j) => j.workerId === workerId && j.stationId === stationId && j.defId === defId);
}

function createJob(state: GameState, def: JobDef, eq: Equipment, workerId: string): Job {
  let total = secondsToTicks(jobSeconds(def, eq));
  if (def.id === 'washFlask' && state.flags['washBoost'] === true) {
    total = Math.max(1, Math.round(total * TUNING.sweetWashNext));
    state.flags['washBoost'] = false;
  }
  const z = TUNING.sweetZone;
  const startFrac = z.minStart + nextFloat(state) * (z.maxStart - z.minStart);
  const sweetStart = Math.round(total * startFrac);
  const sweetEnd = Math.min(total, sweetStart + Math.max(2, Math.round(total * z.width)));
  const job: Job = {
    id: `j${state.nextId++}`,
    defId: def.id,
    stationId: eq.id,
    workerId,
    progressTicks: 0,
    totalTicks: total,
    sweetStart,
    sweetEnd,
    sweetPressed: false,
    sweetHit: false,
  };
  state.jobs[job.id] = job;
  return job;
}

/**
 * Starts (or resumes) a hand-job for the player at a station. With no job id, the first job that
 * is available is used, or the first one if none is. Rejects with a reason the player can read.
 */
export function startJob(state: GameState, eq: Equipment, jobId: string | undefined, events: SimEvent[]): void {
  const player = state.agents[PLAYER];
  if (!player) return;
  const defs = jobsForStation(eq.defId);
  if (defs.length === 0) {
    events.push({ type: 'CommandRejected', reason: 'Nothing to do here yet' });
    return;
  }
  const def = jobId
    ? defs.find((d) => d.id === jobId)
    : (defs.find((d) => jobBlocker(state, d, eq) === null) ?? defs[0]);
  if (!def) return;
  const blocker = jobBlocker(state, def, eq);
  if (blocker) {
    events.push({ type: 'CommandRejected', reason: blocker });
    return;
  }
  const job = findJob(state, PLAYER, eq.id, def.id) ?? createJob(state, def, eq, PLAYER);
  player.jobId = job.id;
  events.push({ type: 'JobStarted', jobId: job.id, defId: def.id, stationId: eq.id });
}

/** The player presses E during a job. One press per job. Inside the green zone it earns the bonus. */
export function pressSweetSpot(state: GameState, job: Job, events: SimEvent[]): void {
  if (job.sweetPressed) return;
  job.sweetPressed = true;
  job.sweetHit = job.progressTicks >= job.sweetStart && job.progressTicks <= job.sweetEnd;
  if (job.sweetHit) state.stats.sweetHits += 1;
  events.push({ type: 'SweetSpot', stationId: job.stationId, hit: job.sweetHit });
}

function toast(events: SimEvent[], text: string): void {
  events.push({ type: 'Toast', text });
}

function removeCulture(state: GameState, c: Culture): void {
  state.cultures = state.cultures.filter((x) => x !== c);
}

/** Applies a finished job's result. Inputs were checked again just before. */
function complete(state: GameState, job: Job, def: JobDef, eq: Equipment, events: SimEvent[]): void {
  const s = state.stock;
  const plotId = plotOf(eq);
  const plot = plotId ? state.plots[plotId] : undefined;
  const hit = job.sweetHit;
  switch (def.id) {
    case 'splitCells': {
      const inc = incubatorWithFreeSlot(state) as Equipment;
      s.cleanFlasks -= 1;
      s.media -= 1;
      let grow = secondsToTicks(tierStat('incubator', 'growSec', inc.tier));
      if (hit) grow = Math.max(1, grow - secondsToTicks(TUNING.sweetGrowSec));
      state.cultures.push({ id: `c${state.nextId++}`, incubatorId: inc.id, growTicksLeft: grow, status: 'growing' });
      state.stats.splits += 1;
      break;
    }
    case 'runExperiment': {
      const culture = state.cultures.find((c) => c.status === 'ready') as Culture;
      removeCulture(state, culture);
      s.assayKits -= 1;
      s.dirtyFlasks += 1;
      if (plot) plot.waste += 1;
      const gain = tierStat('bench', 'experimentData', eq.tier) + (hit ? TUNING.sweetExperimentData : 0);
      state.data += gain;
      state.stats.experiments += 1;
      toast(events, `+${gain} Data`);
      break;
    }
    case 'makeMedia': {
      s.mediaPowder -= 1;
      const made = addStock(state, 'media', TUNING.mediaPerPowder + (hit ? TUNING.sweetMedia : 0));
      state.stats.mediaMade += made;
      toast(events, `+${made} media`);
      break;
    }
    case 'washFlask':
      s.dirtyFlasks -= 1;
      addStock(state, 'cleanFlasks', 1);
      state.stats.washes += 1;
      if (hit) {
        state.flags['washBoost'] = true;
        toast(events, 'The next flask will be quick');
      }
      break;
    case 'takeOutWaste':
      if (plot) plot.waste = 0;
      state.stats.wasteTaken += 1;
      toast(events, 'Waste taken out');
      break;
    case 'tidyUp':
      cleanRoom(state, plotId, TUNING.tidyGain + (hit ? TUNING.sweetTidy : 0));
      state.stats.tidies += 1;
      toast(events, 'Sparkling');
      break;
    case 'binCulture': {
      const bad = state.cultures.find((c) => c.incubatorId === eq.id && c.status === 'contaminated') as Culture;
      removeCulture(state, bad);
      s.dirtyFlasks += 1;
      if (plot) plot.waste += 1;
      state.stats.binned += 1;
      break;
    }
  }
  if (def.dirties) dirtyRoom(state, plotId);
}

/**
 * Runs the player's job. It only moves forward while the player stands in front of the station
 * and looks at it. Walking away pauses it and keeps its progress.
 */
export function jobsSystem(state: GameState, events: SimEvent[]): void {
  const player = state.agents[PLAYER];
  if (!player) return;

  // A click on a station: start its job once the player has arrived.
  if (player.pendingStation && player.path.length === 0 && player.arriveFacing === null) {
    const eq = state.equipment[player.pendingStation];
    player.pendingStation = null;
    if (eq && atStation(player, eq)) startJob(state, eq, undefined, events);
  }

  const job = player.jobId ? state.jobs[player.jobId] : undefined;
  if (!job) {
    player.jobId = null;
    return;
  }
  const eq = state.equipment[job.stationId];
  const def = JOBS[job.defId as keyof typeof JOBS];
  if (!eq || !def) {
    delete state.jobs[job.id];
    player.jobId = null;
    return;
  }
  if (!atStation(player, eq)) return; // paused

  job.progressTicks += 1;
  if (job.progressTicks < job.totalTicks) return;

  delete state.jobs[job.id];
  player.jobId = null;
  const blocker = jobBlocker(state, def, eq);
  if (blocker) {
    // Something changed while we worked, for example the last media was used up elsewhere.
    events.push({ type: 'CommandRejected', reason: blocker });
    return;
  }
  complete(state, job, def, eq, events);
  events.push({ type: 'JobCompleted', defId: def.id, stationId: eq.id });
}
