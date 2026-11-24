import { TICKS_PER_SECOND } from '../../content/balance';
import { tierStat } from '../../content/equipment';
import { PAPER, PRESENTATION } from '../../content/economy';
import { ITEM_NAMES } from '../../content/items';
import { JOBS, TUNING, jobsForStation, type JobDef } from '../../content/jobs';
import { ORDERS, isKnownOrder } from '../../content/orders';
import { ENERGY } from '../../content/staff';
import { OFFICE_WRITE_SPEED } from '../../content/rooms';
import { ROT_FACING, equipmentAt, DIR_VECTORS, frontTiles, opposite } from '../grid';
import { nextFloat } from '../rng';
import type { SimEvent } from '../simEvents';
import { secondsToTicks } from '../ticks';
import { addStock, binFull, coldFree, dryFree, freeSpaceFor, plotOf, storageFullReason } from '../stock';
import type { Agent, Culture, Equipment, GameState, Job } from '../types';
import { cleanRoom, dirtyRoom } from './cleanliness';
import { autoclaveCapacity, startCycle } from './machines';
import { freeSlots, incubatorWithFreeSlot } from './cultures';
import { applyForGrant, grantBlocker, openGrant } from './grants';
import { acceptRevision, paperCost, submitPaper } from './papers';

const PLAYER = 'player';

export { secondsToTicks };

/** Seconds a job takes for the player at this station and tier. */
export function jobSeconds(def: JobDef, eq: Equipment, state?: GameState): number {
  let sec = def.secondsStat ? tierStat(def.station, def.secondsStat, eq.tier, def.seconds) : def.seconds;
  if (def.id === 'takeOutWaste' && state && state.flags['wasteRulesDay'] === state.clock.day) sec += TUNING.wasteRulesExtraSec;
  if (def.speedStat) {
    let speed = tierStat(def.station, def.speedStat, eq.tier, 1);
    const plotId = plotOf(eq);
    if (state && plotId && state.plots[plotId]?.roomType === 'office') speed *= OFFICE_WRITE_SPEED;
    sec /= speed;
  }
  return sec;
}

/** Stations where E opens a menu instead of starting a job: the desk, and a broken fridge (repair). */
export function stationHasMenu(eq: Equipment): boolean {
  return eq.defId === 'desk' || (eq.defId === 'fridge' && eq.broken) || (eq.defId === 'autoclave' && eq.broken);
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
export function jobBlocker(state: GameState, def: JobDef, eq: Equipment, pending = 0): string | null {
  const s = state.stock;
  const plotId = plotOf(eq);
  switch (def.id) {
    case 'splitCells':
      if (s.cleanFlasks <= pending) return 'Needs 1 clean flask';
      if (s.media <= pending) return 'Needs 1 media';
      if (freeSlots(state) <= pending || !incubatorWithFreeSlot(state)) return 'Needs a free incubator slot';
      return null;
    case 'runExperiment':
      if (eq.outTicks && eq.outTicks > 0) return 'The bench computer is installing updates. 1 of 47';
      if (state.cultures.filter((c) => c.status === 'ready').length <= pending) return 'Needs 1 ready culture';
      if (s.assayKits <= pending) return 'Needs 1 assay kit';
      if (!plotId || binFull(state, plotId)) return 'The waste bin is full. Take it out first';
      return null;
    case 'makeMedia':
      if (s.mediaPowder <= pending) return 'Needs 1 media powder';
      if (coldFree(state) < TUNING.mediaPerPowder * (pending + 1)) return `Needs ${TUNING.mediaPerPowder} free spaces in the fridge`;
      return null;
    case 'washFlask':
      if (s.dirtyFlasks <= pending) return 'Needs 1 dirty flask';
      if (dryFree(state) <= pending) return 'The shelf is full';
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
    case 'putAwayOrder': {
      const first = state.boxes[0];
      if (!first || state.boxes.length <= pending) return 'No boxes waiting';
      if (state.boxes.some((b) => boxFits(state, b.orderId))) return null;
      const item = isKnownOrder(first.orderId) ? ORDERS[first.orderId].item : 'assayKits';
      return storageFullReason(state, item);
    }
    case 'writePaper':
      if (state.data < paperCost(state)) return `Needs ${paperCost(state)} Data`;
      return null;
    case 'revisePaper':
      if (!state.papers.some((p) => p.status === 'revise')) return 'No paper needs revising';
      if (state.data < PAPER.reviseData) return `Needs ${PAPER.reviseData} Data`;
      return null;
    case 'makePresentation':
      if (state.data < PRESENTATION.data) return `Needs ${PRESENTATION.data} Data`;
      return null;
    case 'writeGrant':
      return grantBlocker(state);
    case 'signLogbook':
      if (!state.inspection) return 'No inspection is coming';
      if (state.inspection.signed) return 'The logbook is signed';
      return null;
    case 'loadAutoclave':
      if (eq.broken) return 'Out of service. Coax it or call the engineer';
      if (eq.cycle) return eq.cycle.ticksLeft > 0 ? `Running, ${Math.ceil(eq.cycle.ticksLeft / TICKS_PER_SECOND)} s left` : 'Waiting for room on the shelf';
      if (s.dirtyFlasks < 1) return 'Needs 1 dirty flask';
      return null;
    case 'coffeeBreak':
      return null;
  }
}

/** Staff who are working a job, or walking to it, hold their station. The player holds one while standing at it. */
export function holdsStation(state: GameState, job: Job): boolean {
  const w = state.agents[job.workerId];
  if (!w || w.jobId !== job.id) return false;
  if (w.kind !== 'player') return true;
  const eq = state.equipment[job.stationId];
  return !!eq && atStation(w, eq);
}

/** Jobs that hold something right now: a station, and the inputs they will use. */
export function activeJobs(state: GameState): Job[] {
  return Object.values(state.jobs).filter((j) => holdsStation(state, j));
}

/** True when the worker has arrived and is in front of the station (not still walking there). */
function arrived(state: GameState, job: Job): boolean {
  const w = state.agents[job.workerId];
  const eq = state.equipment[job.stationId];
  return !!w && !!eq && atStation(w, eq);
}

/** Ends a job that nobody finished: the worker is freed to pick something else. */
export function releaseJob(state: GameState, job: Job): void {
  delete state.jobs[job.id];
  const w = state.agents[job.workerId];
  if (w && w.jobId === job.id) {
    w.jobId = null;
    if (w.kind !== 'player') {
      w.path = [];
      w.arriveFacing = null;
    }
  }
}

/**
 * Why this worker cannot start the job now, or null. On top of `jobBlocker` it checks the
 * reservations: another worker using the station (the player may take a station that staff are
 * only walking to), and inputs that other jobs in progress will use.
 */
export function startBlocker(state: GameState, def: JobDef, eq: Equipment, workerId: string): string | null {
  const others = activeJobs(state).filter((j) => j.workerId !== workerId);
  if (def.id !== 'coffeeBreak') {
    const holder = others.find((j) => j.stationId === eq.id);
    if (holder && (workerId !== PLAYER || arrived(state, holder) || holder.workerId === PLAYER)) {
      const who = state.agents[holder.workerId]?.staff?.name ?? 'Someone';
      return `${who} is using it`;
    }
  }
  const pending = others.filter((j) => j.defId === def.id && j.stationId !== eq.id).length;
  return jobBlocker(state, def, eq, pending);
}

function boxFits(state: GameState, orderId: string): boolean {
  return isKnownOrder(orderId) && freeSpaceFor(state, ORDERS[orderId].item) >= 1;
}

function findJob(state: GameState, workerId: string, stationId: string, defId: string): Job | undefined {
  return Object.values(state.jobs).find((j) => j.workerId === workerId && j.stationId === stationId && j.defId === defId);
}

export function createJob(state: GameState, def: JobDef, eq: Equipment, workerId: string): Job {
  let total = secondsToTicks(jobSeconds(def, eq, state));
  const byPlayer = workerId === PLAYER;
  if (byPlayer && def.id === 'washFlask' && state.flags['washBoost'] === true) {
    total = Math.max(1, Math.round(total * TUNING.sweetWashNext));
    state.flags['washBoost'] = false;
  }
  // Only the player gets a sweet spot. Staff jobs do not draw from the random stream.
  const z = TUNING.sweetZone;
  const startFrac = byPlayer ? z.minStart + nextFloat(state) * (z.maxStart - z.minStart) : 0;
  const sweetStart = byPlayer ? Math.round(total * startFrac) : 0;
  const sweetEnd = byPlayer ? Math.min(total, sweetStart + Math.max(2, Math.round(total * z.width))) : 0;
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
  const blocker = startBlocker(state, def, eq, PLAYER);
  if (blocker) {
    events.push({ type: 'CommandRejected', reason: blocker });
    return;
  }
  // Staff who are only walking to this station pick another job (design doc 8.7).
  for (const j of Object.values(state.jobs)) {
    if (j.stationId === eq.id && j.workerId !== PLAYER && def.id !== 'coffeeBreak') releaseJob(state, j);
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
export function completeJob(state: GameState, job: Job, def: JobDef, eq: Equipment, events: SimEvent[]): void {
  const worker = state.agents[job.workerId];
  const member = worker?.staff ?? null;
  // Staff work quietly: no toasts for their jobs.
  const say = (text: string): void => {
    if (!member) toast(events, text);
  };
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
      const culture: Culture = { id: `c${state.nextId++}`, incubatorId: inc.id, growTicksLeft: grow, status: 'growing' };
      if (member?.trait === 'goldenHands') culture.golden = true;
      state.cultures.push(culture);
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
      say(`+${gain} Data`);
      break;
    }
    case 'makeMedia': {
      s.mediaPowder -= 1;
      const made = addStock(state, 'media', TUNING.mediaPerPowder + (hit ? TUNING.sweetMedia : 0));
      state.stats.mediaMade += made;
      say(`+${made} media`);
      break;
    }
    case 'washFlask':
      s.dirtyFlasks -= 1;
      addStock(state, 'cleanFlasks', 1);
      state.stats.washes += 1;
      if (hit) {
        state.flags['washBoost'] = true;
        say('The next flask will be quick');
      }
      break;
    case 'takeOutWaste':
      if (plot) plot.waste = 0;
      state.stats.wasteTaken += 1;
      say('Waste taken out');
      break;
    case 'tidyUp':
      cleanRoom(state, plotId, TUNING.tidyGain + (hit ? TUNING.sweetTidy : 0));
      state.stats.tidies += 1;
      say('Sparkling');
      break;
    case 'binCulture': {
      const bad = state.cultures.find((c) => c.incubatorId === eq.id && c.status === 'contaminated') as Culture;
      removeCulture(state, bad);
      s.dirtyFlasks += 1;
      if (plot) plot.waste += 1;
      state.stats.binned += 1;
      break;
    }
    case 'putAwayOrder': {
      const box = state.boxes.find((b) => boxFits(state, b.orderId)) as (typeof state.boxes)[number];
      const od = ORDERS[box.orderId as keyof typeof ORDERS];
      const added = addStock(state, od.item, box.qty);
      box.qty -= added;
      if (box.qty <= 0) state.boxes = state.boxes.filter((b) => b !== box);
      state.stats.boxesPutAway += 1;
      const left = box.qty > 0 ? `, ${box.qty} still waiting` : '';
      say(`Put away ${added} ${ITEM_NAMES[od.item].toLowerCase()}${left}`);
      break;
    }
    case 'writePaper': {
      state.data -= paperCost(state);
      const paper = submitPaper(state);
      say(`Paper ${paper.number} sent to review`);
      break;
    }
    case 'revisePaper': {
      state.data -= PAPER.reviseData;
      const paper = state.papers.find((p) => p.status === 'revise') as (typeof state.papers)[number];
      acceptRevision(state, paper, events);
      break;
    }
    case 'makePresentation':
      state.data -= PRESENTATION.data;
      state.reputation += PRESENTATION.reputation;
      state.stats.presentations += 1;
      state.presentations += 1;
      say(`Presentation done! +${PRESENTATION.reputation} Reputation`);
      break;
    case 'writeGrant': {
      const grant = openGrant(state);
      if (grant) applyForGrant(state, grant, events);
      break;
    }
    case 'signLogbook':
      if (state.inspection) state.inspection.signed = true;
      say('Logbook signed');
      break;
    case 'loadAutoclave': {
      const n = Math.min(autoclaveCapacity(eq), s.dirtyFlasks);
      s.dirtyFlasks -= n;
      startCycle(eq, n);
      say(`Autoclave running with ${n} flask${n === 1 ? '' : 'es'}`);
      break;
    }
    case 'coffeeBreak':
      if (member) {
        member.energy = ENERGY.max;
        member.workAcc = 0;
      } else {
        state.flags['coffeeTicks'] = secondsToTicks(TUNING.coffee.seconds);
        say(`Coffee! Work is ${Math.round(TUNING.coffee.speedBonus * 100)}% faster for ${TUNING.coffee.seconds} s`);
      }
      break;
  }
  if (def.dirties && member?.trait !== 'tidy') dirtyRoom(state, plotId);
}

/**
 * Runs the player's job. It only moves forward while the player stands in front of the station
 * and looks at it. Walking away pauses it and keeps its progress.
 */
export function jobsSystem(state: GameState, events: SimEvent[]): void {
  const player = state.agents[PLAYER];
  if (!player) return;

  const coffee = state.flags['coffeeTicks'];
  const boosted = typeof coffee === 'number' && coffee > 0;
  if (boosted) state.flags['coffeeTicks'] = coffee - 1;

  // A click on a station: start its job once the player has arrived.
  if (player.pendingStation && player.path.length === 0 && player.arriveFacing === null) {
    const eq = state.equipment[player.pendingStation];
    player.pendingStation = null;
    if (eq && atStation(player, eq)) {
      // A station with a menu opens it on arrival. Others start their first available job.
      if (stationHasMenu(eq)) events.push({ type: 'StationReached', stationId: eq.id });
      else startJob(state, eq, undefined, events);
    }
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
  // After a coffee break the player works a little faster: an extra tick every tenth tick.
  if (boosted && state.tick % Math.round(1 / TUNING.coffee.speedBonus) === 0) job.progressTicks += 1;
  if (job.progressTicks < job.totalTicks) return;

  delete state.jobs[job.id];
  player.jobId = null;
  const blocker = jobBlocker(state, def, eq);
  if (blocker) {
    // Something changed while we worked, for example the last media was used up elsewhere.
    events.push({ type: 'CommandRejected', reason: blocker });
    return;
  }
  completeJob(state, job, def, eq, events);
  events.push({ type: 'JobCompleted', defId: def.id, stationId: eq.id });
}
