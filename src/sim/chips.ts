import { GRANTS } from '../content/economy';
import { INSPECTION, REQUESTS } from '../content/events';
import { checkPasses, stickyNotes } from './systems/inspection';
import { describeLeft, describeTimeline, timelineAt, timelineTick } from './ticks';
import type { ActiveRequest, GameState, InspectionCheck } from './types';

export interface Chip {
  id: string;
  kind: 'request' | 'grant' | 'inspection';
  /** The bold part. */
  label: string;
  /** The rest: progress and time left. */
  detail: string;
  /** warn when there is under a day left, or a deadline has moved. */
  tone: 'info' | 'warn';
}

/** How far along a request is, such as "2/3". */
export function requestProgressText(state: GameState, req: ActiveRequest): string {
  const now = (stat: string): number => (stat === 'presentations' ? state.stats.presentations : stat === 'splits' ? state.stats.splits : state.stats.experiments);
  const word = (stat: string): string => (stat === 'presentations' ? 'presentation' : stat === 'splits' ? 'splits' : 'experiments');
  return req.needs.map((n) => `${Math.min(n.target, now(n.stat) - n.base)}/${n.target} ${word(n.stat)}`).join(', ');
}

/** The chips under the top bar: PI requests, grant countdowns and the inspection. */
export function chips(state: GameState): Chip[] {
  const out: Chip[] = [];
  const T = timelineTick(state);
  for (const req of state.director.requests) {
    const def = REQUESTS[req.id];
    if (!def) continue;
    const left = req.dueT - T;
    out.push({
      id: `req:${req.id}`,
      kind: 'request',
      label: `Prof. Quince: ${def.label}`,
      detail: `${requestProgressText(state, req)}. ${describeLeft(left)} left`,
      tone: left < 2400 ? 'warn' : 'info',
    });
  }
  for (const g of GRANTS) {
    const call = state.grantCalls[g.id];
    if (!call?.announced || call.deadlineDay === null || state.grants[g.id]) continue;
    const dueT = timelineAt(call.deadlineDay, 2160); // 17:00
    const left = dueT - T;
    const moved = call.crashes > 0;
    out.push({
      id: `grant:${g.id}`,
      kind: 'grant',
      label: g.name,
      detail: `${describeTimeline(dueT)}, ${describeLeft(left)} left${moved ? `. Pays ${call.payPercent}%` : ''}`,
      tone: left < 2400 || moved ? 'warn' : 'info',
    });
  }
  const ins = state.inspection;
  if (ins && ins.phase === 'announced') {
    out.push({ id: 'insp', kind: 'inspection', label: 'Inspection', detail: `${describeTimeline(ins.visitT)}, ${describeLeft(ins.visitT - T)} to go`, tone: 'info' });
  } else if (ins && ins.phase === 'visiting') {
    out.push({ id: 'insp', kind: 'inspection', label: 'Inspector Tock is here', detail: 'Clipboard out', tone: 'warn' });
  }
  return out;
}

export interface ChecklistRow {
  id: InspectionCheck;
  label: string;
  /** What to do, shown while it still fails. */
  fix: string;
  ok: boolean;
}

export interface InspectionNote {
  title: string;
  rows: ChecklistRow[];
  /** After the visit the list shows only what is left to fix, as sticky notes. */
  after: boolean;
}

/** The inspection checklist before the visit, and the sticky notes after it. Null when there is nothing to show. */
export function inspectionNote(state: GameState): InspectionNote | null {
  const ins = state.inspection;
  if (!ins) return null;
  if (ins.phase === 'done') {
    const todo = stickyNotes(state);
    if (todo.length === 0) return null;
    return {
      title: 'Tock left notes',
      after: true,
      rows: INSPECTION.checks.filter((c) => todo.includes(c.id)).map((c) => ({ id: c.id, label: c.label, fix: c.fix, ok: false })),
    };
  }
  return {
    title: 'Inspection checklist',
    after: false,
    rows: INSPECTION.checks.map((c) => ({ id: c.id, label: c.label, fix: c.fix, ok: checkPasses(state, c.id) })),
  };
}

/** What an email's request chip says, or null if the email did not start a request. */
export function emailRequestStatus(state: GameState, emailKind: string, emailId: string): { tone: 'open' | 'done' | 'missed' | 'closed'; text: string } | null {
  const def = REQUESTS[emailKind];
  if (!def) return null;
  const active = state.director.requests.find((r) => r.id === emailKind);
  const latest = [...state.inbox].reverse().find((m) => m.kind === emailKind);
  if (active && latest?.id === emailId) {
    return { tone: 'open', text: `Open: ${requestProgressText(state, active)}. ${describeLeft(active.dueT - timelineTick(state))} left` };
  }
  const outcome = state.director.resolved[emailKind];
  if (latest?.id === emailId && outcome === 'done') return { tone: 'done', text: 'Done. Reward paid' };
  if (latest?.id === emailId && outcome === 'missed') return { tone: 'missed', text: 'Missed. No worries' };
  return { tone: 'closed', text: 'Closed' };
}
