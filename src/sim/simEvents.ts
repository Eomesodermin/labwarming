import type { Speed } from './types';

/** One person's pay on the end-of-day card. */
export interface SalaryLine {
  name: string;
  role: string;
  amount: number;
}

/** The event bus. `step` returns the events of one tick. They are for presentation only. */
export type SimEvent =
  | { type: 'CommandRejected'; reason: string }
  | { type: 'SpeedChanged'; speed: Speed }
  | { type: 'DayEnded'; day: number }
  | { type: 'EndOfDay'; day: number; funding: number; salaries: SalaryLine[]; salaryTotal: number; covered: boolean; funds: number }
  | { type: 'StaffHired'; agentId: string; name: string }
  | { type: 'StaffLeft'; agentId: string; name: string }
  | { type: 'EmailReceived'; emailId: string; kind: string; subject: string }
  | { type: 'StationReached'; stationId: string }
  | { type: 'Purchase'; what: string }
  | { type: 'PaperReviewed'; paperId: string; status: 'accepted' | 'revise' }
  | { type: 'GrantAwarded'; grantId: string }
  | { type: 'BoxDelivered'; boxId: string }
  | { type: 'JobStarted'; jobId: string; defId: string; stationId: string }
  | { type: 'JobCompleted'; defId: string; stationId: string }
  | { type: 'SweetSpot'; stationId: string; hit: boolean }
  | { type: 'CultureReady'; cultureId: string }
  | { type: 'CultureContaminated'; cultureId: string }
  | { type: 'Toast'; text: string };
