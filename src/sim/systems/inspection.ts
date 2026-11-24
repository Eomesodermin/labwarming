import { INSPECTION } from '../../content/events';
import type { SimEvent } from '../simEvents';
import { binFull, wasteCapacity } from '../stock';
import { timelineTick } from '../ticks';
import type { GameState, InspectionCheck } from '../types';
import { fireEvent } from './eventCore';
import { spawnVisit } from './visits';

/** True when any owned room has a bin that is full. */
export function anyBinFull(state: GameState): boolean {
  return Object.values(state.plots).some((p) => p.owned && wasteCapacity(state, p.id) > 0 && binFull(state, p.id));
}

export function anyRoomDirty(state: GameState): boolean {
  return Object.values(state.plots).some((p) => p.owned && p.cleanliness < INSPECTION.cleanAtLeast);
}

export function fridgeBroken(state: GameState): boolean {
  return Object.values(state.equipment).some((e) => e.defId === 'fridge' && e.broken);
}

/** Whether a check is passing right now. */
export function checkPasses(state: GameState, id: InspectionCheck): boolean {
  switch (id) {
    case 'logbook':
      return state.inspection?.signed === true;
    case 'waste':
      return !anyBinFull(state);
    case 'clean':
      return !anyRoomDirty(state);
    case 'fridge':
      return !fridgeBroken(state);
  }
}

/** Tock looks at one room: a full bin or a dirty room fails the whole check. */
export function inspectRoom(state: GameState, plotId: string): void {
  const ins = state.inspection;
  const plot = state.plots[plotId];
  if (!ins || !plot) return;
  if (wasteCapacity(state, plotId) > 0 && binFull(state, plotId)) ins.wasteOk = false;
  if (plot.cleanliness < INSPECTION.cleanAtLeast) ins.cleanOk = false;
}

/** The tour is over: pay the passed checks, write the report, leave sticky notes for the rest. */
export function finishInspection(state: GameState, events: SimEvent[]): void {
  const ins = state.inspection;
  if (!ins) return;
  const result: Record<InspectionCheck, boolean> = {
    logbook: ins.signed,
    waste: ins.wasteOk && !anyBinFull(state),
    clean: ins.cleanOk && !anyRoomDirty(state),
    fridge: !fridgeBroken(state),
  };
  const lines: string[] = [];
  let passed = 0;
  const missed: InspectionCheck[] = [];
  for (const c of INSPECTION.checks) {
    const ok = result[c.id];
    if (ok) passed += 1;
    else missed.push(c.id);
    lines.push(`${c.label}: ${ok ? INSPECTION.passLine : INSPECTION.missLine}`);
  }
  const funds = passed * INSPECTION.passFunds;
  let rep = passed * INSPECTION.passReputation;
  const all = missed.length === 0;
  if (all) {
    rep += INSPECTION.allReputation;
    state.flags['goldStar'] = true;
    lines.push('Tock puts a gold star on the lab door and means it.');
  }
  state.funds += funds;
  state.reputation += rep;
  state.stats.inspectionsDone += 1;
  lines.push(`+${funds} Funds, +${rep} Reputation.`);
  if (!all) lines.push('Sticky notes are on the lab door. There is no fine.');
  ins.phase = 'done';
  ins.missed = missed;
  if (all) state.inspection = null;
  fireEvent(state, 'insp_visit', events, { params: { report: lines.join('\n') } });
  events.push({ type: 'Toast', text: all ? 'All four checks passed! A gold star for the lab door' : `Inspection done: ${passed} of 4 checks passed` });
}

/** The checks that were missed and still fail, as sticky notes to fix. */
export function stickyNotes(state: GameState): InspectionCheck[] {
  const ins = state.inspection;
  if (!ins || ins.phase !== 'done') return [];
  return ins.missed.filter((id) => !checkPasses(state, id));
}

/** Starts the visit at the set time, and clears the notes once they are all fixed. */
export function inspectionSystem(state: GameState, events: SimEvent[]): void {
  const ins = state.inspection;
  if (!ins) return;
  if (ins.phase === 'announced' && timelineTick(state) >= ins.visitT) {
    ins.phase = 'visiting';
    const visit = spawnVisit(state, 'inspection', events);
    if (!visit) finishInspection(state, events);
    return;
  }
  if (ins.phase === 'visiting' && !state.director.visits.some((v) => v.kind === 'inspection')) {
    // The visit was lost (a loaded game, say). Finish it now.
    finishInspection(state, events);
    return;
  }
  if (ins.phase === 'done' && state.tick % 10 === 0 && stickyNotes(state).length === 0) state.inspection = null;
}
