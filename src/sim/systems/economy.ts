import { CORE_FUNDING } from '../../content/economy';
import { PAYROLL, ROLES } from '../../content/staff';
import type { SalaryLine, SimEvent } from '../simEvents';
import type { GameState } from '../types';
import { makeCandidates, staffAgents } from './staff';

/**
 * The end of the day at 18:00: core funding arrives, then salaries are paid. If that would take
 * Funds below zero, the balance goes negative, down to the floor in `PAYROLL` (design doc 5.3).
 * The new day's candidates are drawn here, so they are ready in the morning.
 */
export function endOfDay(state: GameState, endedDay: number, events: SimEvent[]): void {
  state.funds += CORE_FUNDING;
  const salaries: SalaryLine[] = staffAgents(state).map((a) => ({
    name: a.staff?.name ?? '',
    role: a.staff ? ROLES[a.staff.role].name : '',
    amount: a.staff?.salary ?? 0,
  }));
  const salaryTotal = salaries.reduce((n, l) => n + l.amount, 0);
  if (salaryTotal > 0) state.funds = Math.max(PAYROLL.floor, state.funds - salaryTotal);
  const covered = salaryTotal > 0 && state.funds < 0;
  state.candidates = makeCandidates(state);
  events.push({ type: 'EndOfDay', day: endedDay, funding: CORE_FUNDING, salaries, salaryTotal, covered, funds: state.funds });
}
