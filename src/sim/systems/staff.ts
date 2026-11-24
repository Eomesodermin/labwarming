import { DAY_END_HOUR, DAY_START_HOUR, TICKS_PER_DAY, TICKS_PER_SECOND } from '../../content/balance';
import { tierStat } from '../../content/equipment';
import { JOBS, type JobId } from '../../content/jobs';
import { ENTRANCE } from '../../content/map';
import { FIRE_DRILL } from '../../content/events';
import {
  CANDIDATES_PER_ROLE,
  ENERGY,
  HIREABLE_ROLES,
  MAX_PER_ROLE,
  MOOD,
  PORTRAIT_COLOURS,
  ROLES,
  STAFF_AI,
  STAFF_NAMES,
  TRAIT_ORDER,
  TRAIT_TUNING,
  type StaffRole,
} from '../../content/staff';
import { ROT_FACING, baseTile, frontTiles, opposite } from '../grid';
import { spendBlocker } from '../funds';
import { findPathToAny } from '../pathfinding';
import { mulberry32 } from '../rng';
import type { SimEvent } from '../simEvents';
import { secondsToTicks } from '../ticks';
import { binFull, plotOf, wasteCapacity } from '../stock';
import type { Agent, Candidate, Equipment, GameState, Job, Point } from '../types';
import { atStation, completeJob, createJob, jobBlocker, releaseJob, startBlocker } from './jobs';


/** Everyone on the payroll, in the order they were hired. */
export function staffAgents(state: GameState): Agent[] {
  return Object.values(state.agents).filter((a) => a.staff !== null);
}

export function staffCount(state: GameState, role: StaffRole): number {
  return staffAgents(state).filter((a) => a.staff?.role === role).length;
}

// ---- Candidates ----

/** Candidates for the current day. They come from their own random stream, so the game's stream is untouched. */
export function makeCandidates(state: GameState): Candidate[] {
  let rs = (state.seed ^ Math.imul(state.clock.day, 0x9e3779b1)) >>> 0;
  const draw = (n: number): number => {
    const r = mulberry32(rs);
    rs = r.state;
    return Math.floor(r.value * n);
  };
  const taken = new Set(staffAgents(state).map((a) => a.staff?.name ?? ''));
  const out: Candidate[] = [];
  for (const role of HIREABLE_ROLES) {
    for (let i = 0; i < CANDIDATES_PER_ROLE; i++) {
      let k = draw(STAFF_NAMES.length);
      for (let t = 0; t < STAFF_NAMES.length && taken.has(STAFF_NAMES[k] as string); t++) k = (k + 1) % STAFF_NAMES.length;
      const name = STAFF_NAMES[k] as string;
      taken.add(name);
      out.push({
        id: `cand${state.clock.day}-${role}-${i}`,
        role,
        name,
        trait: TRAIT_ORDER[draw(TRAIT_ORDER.length)] as Candidate['trait'],
        colour: PORTRAIT_COLOURS[draw(PORTRAIT_COLOURS.length)] as Candidate['colour'],
      });
    }
  }
  return out;
}

/** Why a role cannot be hired yet, or null. This does not look at Funds. */
export function roleBlocker(state: GameState, role: StaffRole): string | null {
  const def = ROLES[role];
  if (state.reputation < def.unlockRep) return def.lockedText;
  const plots = Object.values(state.plots).filter((p) => p.owned);
  if (def.needsRoom && !plots.some((p) => p.roomType === def.needsRoom)) return def.lockedText;
  if (def.needsRooms && plots.length < def.needsRooms) return def.lockedText;
  if (staffCount(state, role) >= MAX_PER_ROLE) return `You already have ${MAX_PER_ROLE}`;
  return null;
}

export function hireBlocker(state: GameState, role: StaffRole): string | null {
  return roleBlocker(state, role) ?? spendBlocker(state, ROLES[role].fee);
}

export function hireStaff(state: GameState, candidateId: string, events: SimEvent[]): void {
  const cand = state.candidates.find((c) => c.id === candidateId);
  if (!cand) {
    events.push({ type: 'CommandRejected', reason: 'That person has gone home' });
    return;
  }
  const blocker = hireBlocker(state, cand.role);
  if (blocker) {
    events.push({ type: 'CommandRejected', reason: blocker });
    return;
  }
  const role = ROLES[cand.role];
  state.funds -= role.fee;
  state.candidates = state.candidates.filter((c) => c.id !== cand.id);
  const agent: Agent = {
    id: `s${state.nextId++}`,
    kind: cand.role,
    x: ENTRANCE.x,
    y: ENTRANCE.y,
    facing: 'right',
    path: [],
    moveProgress: 0,
    arriveFacing: null,
    jobId: null,
    pendingStation: null,
    staff: {
      name: cand.name,
      role: cand.role,
      trait: cand.trait,
      colour: cand.colour,
      salary: role.salary,
      energy: ENERGY.max,
      workAcc: 0,
      mood: MOOD.base,
      restTicks: 0,
    },
  };
  state.agents[agent.id] = agent;
  if (agent.staff) agent.staff.mood = computeMood(state, agent);
  events.push({ type: 'Purchase', what: 'Hire' });
  events.push({ type: 'StaffHired', agentId: agent.id, name: cand.name });
  events.push({ type: 'Toast', text: `${cand.name} joins as ${role.name.toLowerCase()}. They walk in with a lanyard` });
}

export function partWays(state: GameState, agentId: string, events: SimEvent[]): void {
  const agent = state.agents[agentId];
  if (!agent?.staff) {
    events.push({ type: 'CommandRejected', reason: 'Nobody to part ways with' });
    return;
  }
  for (const j of Object.values(state.jobs)) if (j.workerId === agentId) releaseJob(state, j);
  delete state.agents[agentId];
  events.push({ type: 'StaffLeft', agentId, name: agent.staff.name });
  events.push({ type: 'Toast', text: `${agent.staff.name} has moved on. They left their mug` });
}

// ---- Mood and speed ----

export function isOnBreak(state: GameState, agent: Agent): boolean {
  const st = agent.staff;
  if (!st) return false;
  if (st.restTicks > 0) return true;
  const job = agent.jobId ? state.jobs[agent.jobId] : undefined;
  return job?.defId === 'coffeeBreak';
}

/** The room (plot id) an agent stands in, or null in the corridor. */
function roomOf(agent: Agent): string | null {
  return baseTile(agent.x, agent.y).plotId;
}

/** Mood from the formula in design doc 4.5, clamped to 0 to 100. */
export function computeMood(state: GameState, agent: Agent): number {
  const st = agent.staff;
  if (!st) return MOOD.base;
  let up: number = MOOD.base;
  let down = 0;
  const eqs = Object.values(state.equipment);
  const coffee = eqs.filter((e) => e.defId === 'coffee');
  if (coffee.length > 0) up += Math.max(...coffee.map((e) => tierStat('coffee', 'mood', e.tier, MOOD.coffee)));
  const sofa = eqs.find((e) => e.defId === 'sofa');
  if (sofa) up += tierStat('sofa', 'mood', sofa.tier, MOOD.sofa);
  const plants = eqs.filter((e) => e.defId === 'plant');
  if (plants.length > 0) up += Math.min(plants.length, MOOD.plantMax) * tierStat('plant', 'mood', 1, MOOD.plantEach);
  const here = roomOf(agent);
  const plot = here ? state.plots[here] : undefined;
  if (plot?.owned) {
    if (plot.cleanliness >= MOOD.cleanRoom.atLeast) up += MOOD.cleanRoom.bonus;
    else if (plot.cleanliness < MOOD.dirtyRoom.below) down += MOOD.dirtyRoom.penalty;
  }
  if (Object.values(state.plots).some((p) => p.owned && wasteCapacity(state, p.id) > 0 && binFull(state, p.id))) down += MOOD.fullBin;
  if (state.flags['piRequest'] === true) down += MOOD.piRequest;
  const cake = state.flags['cakeTicks'];
  if (typeof cake === 'number' && cake > 0) up += MOOD.cake;
  const drill = state.flags['drillMoodTicks'];
  if (typeof drill === 'number' && drill > 0) up += FIRE_DRILL.moodBonus;
  for (const other of staffAgents(state)) {
    if (other.id === agent.id || !other.staff) continue;
    if (other.staff.trait === 'humsWhilePipetting' && here !== null && roomOf(other) === here) up += TRAIT_TUNING.humMood;
    if (other.staff.trait === 'chatty' && isOnBreak(state, other)) up += TRAIT_TUNING.chattyMood;
  }
  if (st.trait === 'hasSeenThings') down = 0;
  return Math.max(0, Math.min(100, up + down));
}

/** Job speed from Mood: 0.9 at Mood 0 and 1.1 at Mood 100. */
export function moodSpeed(mood: number): number {
  return MOOD.speedAtZero + ((MOOD.speedAtMax - MOOD.speedAtZero) * mood) / 100;
}

const NOON_TICK = ((TRAIT_TUNING.earlyBirdUntilHour - DAY_START_HOUR) * TICKS_PER_DAY) / (DAY_END_HOUR - DAY_START_HOUR);

/** How much job progress one tick gives this person, as a multiple of the player's pace. */
export function workRate(state: GameState, agent: Agent, defId: string): number {
  const st = agent.staff;
  if (!st) return 1;
  if (defId === 'coffeeBreak') return 1;
  let r = ROLES[st.role].speed * moodSpeed(st.mood);
  switch (st.trait) {
    case 'coffeePowered':
      r *= TRAIT_TUNING.coffeePoweredSpeed;
      break;
    case 'earlyBird':
      r *= state.clock.tickOfDay < NOON_TICK ? TRAIT_TUNING.earlyBirdMorning : TRAIT_TUNING.earlyBirdAfternoon;
      break;
    case 'labelsEverything':
      if (defId === 'putAwayOrder') r *= TRAIT_TUNING.labelsEverythingPutAway;
      break;
    default:
      break;
  }
  return r;
}

// ---- Choosing work ----

function frontsOf(eq: Equipment): Point[] {
  return frontTiles(eq);
}

function stationsOf(state: GameState, defId: string): Equipment[] {
  return Object.values(state.equipment)
    .filter((e) => e.defId === defId)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

/** Whether staff should do this job first. A job that is possible but not wanted is only a fallback. */
function aiWants(state: GameState, id: JobId, eq: Equipment): boolean {
  if (id === 'takeOutWaste') {
    const plotId = plotOf(eq);
    if (!plotId) return false;
    return (state.plots[plotId]?.waste ?? 0) >= wasteCapacity(state, plotId) * STAFF_AI.wasteFraction;
  }
  if (id === 'loadAutoclave') return state.stock.dirtyFlasks >= STAFF_AI.autoclaveMinFlasks || stationsOf(state, 'sink').length === 0;
  return true;
}

interface Pick {
  eq: Equipment;
  def: (typeof JOBS)[JobId];
  path: Point[];
}

function best(candidates: Pick[]): Pick | null {
  let out: Pick | null = null;
  for (const c of candidates) if (out === null || c.path.length < out.path.length) out = c; // ties keep the lower id
  return out;
}

/** The first job in the role's priority list that is available and reachable. Ties go to the nearest station. */
function pickJob(state: GameState, agent: Agent): Pick | null {
  const st = agent.staff;
  if (!st) return null;
  const origin = { x: agent.x, y: agent.y };
  const fallback: Pick[] = [];
  for (const id of ROLES[st.role].priority) {
    const def = JOBS[id];
    const wanted: Pick[] = [];
    for (const eq of stationsOf(state, def.station)) {
      if (startBlocker(state, def, eq, agent.id) !== null) continue;
      // A station with no reachable front tile is unusable: pick something else (design doc 8.7).
      const path = findPathToAny(state, origin, frontsOf(eq));
      if (!path) continue;
      (aiWants(state, id, eq) ? wanted : fallback).push({ eq, def, path });
    }
    const hit = best(wanted);
    if (hit) return hit;
  }
  return best(fallback);
}

function assign(agent: Agent, state: GameState, pick: Pick, workerFacing = true): Job {
  const job = createJob(state, pick.def, pick.eq, agent.id);
  agent.jobId = job.id;
  agent.path = pick.path;
  agent.moveProgress = 0;
  agent.arriveFacing = workerFacing ? opposite(ROT_FACING[pick.eq.rot]) : null;
  return job;
}

function startBreak(state: GameState, agent: Agent): void {
  const st = agent.staff;
  if (!st) return;
  const chatty = st.trait === 'chatty' ? TRAIT_TUNING.chattyBreak : 1;
  const origin = { x: agent.x, y: agent.y };
  const def = JOBS.coffeeBreak;
  const options: Pick[] = [];
  for (const eq of stationsOf(state, 'coffee')) {
    const path = findPathToAny(state, origin, frontsOf(eq));
    if (path) options.push({ eq, def, path });
  }
  const hit = best(options);
  if (hit) {
    const job = assign(agent, state, hit);
    job.totalTicks = Math.max(1, Math.round(job.totalTicks * chatty));
  } else {
    // No coffee machine to walk to: sit down where they are.
    agent.path = [];
    agent.arriveFacing = null;
    st.restTicks = secondsToTicks(ENERGY.noCoffeeBreakSec * chatty);
  }
}

/**
 * Idle staff choose what to do: a break if they are tired, otherwise the first available job in
 * the role's priority list. Runs before movement. It uses no random numbers.
 */
export function staffAiSystem(state: GameState): void {
  if (state.candidates.length === 0) state.candidates = makeCandidates(state); // saves from before staff
  if (state.tick % STAFF_AI.thinkEveryTicks !== 0) return;
  for (const agent of staffAgents(state)) {
    const st = agent.staff;
    if (!st || st.restTicks > 0) continue;
    if (state.director.drill) continue; // fire alarm test: everyone is outside
    if (agent.jobId && state.jobs[agent.jobId]) continue;
    agent.jobId = null;
    if (st.energy <= ENERGY.breakAt) {
      startBreak(state, agent);
      continue;
    }
    const pick = pickJob(state, agent);
    if (pick) assign(agent, state, pick);
  }
}

/**
 * Staff work: walk to the station (or find another way when it moved), progress the job at the
 * person's pace, lose Energy while working, and finish. Runs after movement.
 */
export function staffWorkSystem(state: GameState, events: SimEvent[]): void {
  for (const agent of staffAgents(state)) {
    const st = agent.staff;
    if (!st) continue;
    if (st.restTicks > 0) {
      st.restTicks -= 1;
      if (st.restTicks === 0) {
        st.energy = ENERGY.max;
        st.workAcc = 0;
      }
      continue;
    }
    if (state.director.drill) continue; // jobs keep their progress while everyone stands outside
    const job = agent.jobId ? state.jobs[agent.jobId] : undefined;
    if (!job) {
      agent.jobId = null;
      continue;
    }
    const eq = state.equipment[job.stationId];
    const def = JOBS[job.defId as JobId];
    if (!eq || !def) {
      releaseJob(state, job);
      continue;
    }
    if (!atStation(agent, eq)) {
      if (agent.path.length === 0 && agent.arriveFacing === null) {
        // Standing somewhere else with no route: the station moved, or the way changed. Find the way again.
        const route = findPathToAny(state, { x: agent.x, y: agent.y }, frontsOf(eq));
        if (!route) {
          releaseJob(state, job);
          continue;
        }
        agent.path = route;
        agent.arriveFacing = opposite(ROT_FACING[eq.rot]);
      }
      continue;
    }
    if (job.progressTicks === 0 && startBlocker(state, def, eq, agent.id) !== null) {
      releaseJob(state, job); // something changed on the way
      continue;
    }
    job.progressTicks += workRate(state, agent, def.id);
    if (def.id !== 'coffeeBreak') {
      st.workAcc += st.trait === 'coffeePowered' ? TRAIT_TUNING.coffeePoweredDrain : 1;
      const per = ENERGY.drainEverySec * TICKS_PER_SECOND;
      while (st.workAcc >= per) {
        st.workAcc -= per;
        st.energy = Math.max(0, st.energy - 1);
      }
    }
    if (job.progressTicks < job.totalTicks) continue;
    delete state.jobs[job.id];
    agent.jobId = null;
    if (jobBlocker(state, def, eq) === null) {
      completeJob(state, job, def, eq, events);
      events.push({ type: 'JobCompleted', defId: def.id, stationId: eq.id });
    }
  }
}

/** Mood is recalculated every 10 s. */
export function needsSystem(state: GameState): void {
  const now = state.flags['moodNow'] === true; // cake, pizza and the fire drill ask for an early look
  if (now) state.flags['moodNow'] = false;
  if (!now && state.tick % (MOOD.everySec * TICKS_PER_SECOND) !== 0) return;
  for (const agent of staffAgents(state)) if (agent.staff) agent.staff.mood = computeMood(state, agent);
}

