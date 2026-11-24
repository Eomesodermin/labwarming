import type { EquipmentDefId } from '../sim/types';
import { GRANT_WRITE_SEC, PAPER, PRESENTATION } from './economy';
import { INSPECTION } from './events';

export type JobId =
  | 'splitCells'
  | 'runExperiment'
  | 'makeMedia'
  | 'washFlask'
  | 'takeOutWaste'
  | 'tidyUp'
  | 'binCulture'
  | 'putAwayOrder'
  | 'writePaper'
  | 'revisePaper'
  | 'makePresentation'
  | 'writeGrant'
  | 'loadAutoclave'
  | 'coffeeBreak'
  | 'signLogbook';

export interface JobDef {
  id: JobId;
  /** Shown in prompts, e.g. "E: Split cells". */
  name: string;
  station: EquipmentDefId;
  /** Seconds at 1x for the player, unless `secondsStat` names a tier stat on the station. */
  seconds: number;
  secondsStat?: string;
  /** A tier stat that divides the time (the desk's writing speed). */
  speedStat?: string;
  /** Finishing this job lowers the room's Cleanliness. */
  dirties: boolean;
}

/** In priority order per station: E uses the first job that is available, Q the second. */
export const JOBS: Record<JobId, JobDef> = {
  splitCells: { id: 'splitCells', name: 'Split cells', station: 'hood', seconds: 10, secondsStat: 'splitSec', dirties: true },
  runExperiment: {
    id: 'runExperiment',
    name: 'Run experiment',
    station: 'bench',
    seconds: 15,
    secondsStat: 'experimentSec',
    dirties: true,
  },
  makeMedia: { id: 'makeMedia', name: 'Make media', station: 'bench', seconds: 12, dirties: true },
  washFlask: { id: 'washFlask', name: 'Wash flask', station: 'sink', seconds: 5, secondsStat: 'washSec', dirties: true },
  takeOutWaste: { id: 'takeOutWaste', name: 'Take out waste', station: 'bin', seconds: 4, dirties: true },
  tidyUp: { id: 'tidyUp', name: 'Tidy up', station: 'spray', seconds: 8, dirties: false },
  binCulture: { id: 'binCulture', name: 'Bin a culture', station: 'incubator', seconds: 3, dirties: true },
  putAwayOrder: { id: 'putAwayOrder', name: 'Put away order', station: 'bay', seconds: 6, dirties: false },
  writePaper: { id: 'writePaper', name: 'Write paper', station: 'desk', seconds: PAPER.writeSec, speedStat: 'speed', dirties: false },
  revisePaper: { id: 'revisePaper', name: 'Revise paper', station: 'desk', seconds: PAPER.reviseSec, speedStat: 'speed', dirties: false },
  makePresentation: {
    id: 'makePresentation',
    name: 'Make presentation',
    station: 'desk',
    seconds: PRESENTATION.sec,
    speedStat: 'speed',
    dirties: false,
  },
  writeGrant: { id: 'writeGrant', name: 'Write grant', station: 'desk', seconds: GRANT_WRITE_SEC, speedStat: 'speed', dirties: false },
  loadAutoclave: {
    id: 'loadAutoclave',
    name: 'Run autoclave',
    station: 'autoclave',
    seconds: 6,
    secondsStat: 'loadSec',
    dirties: true,
  },
  signLogbook: { id: 'signLogbook', name: 'Sign logbook', station: 'desk', seconds: INSPECTION.signLogbookSec, speedStat: 'speed', dirties: false },
  coffeeBreak: { id: 'coffeeBreak', name: 'Coffee break', station: 'coffee', seconds: 20, secondsStat: 'breakSec', dirties: false },
};

export function jobsForStation(defId: EquipmentDefId): JobDef[] {
  return Object.values(JOBS).filter((j) => j.station === defId);
}

/** Numbers behind the hand-jobs. Change them here. */
export const TUNING = {
  /** The sweet-spot green zone: where it starts (fraction of the bar, random in this range) and how wide. */
  sweetZone: { minStart: 0.35, maxStart: 0.7, width: 0.22 },
  /** Split cells: a culture grows this many seconds faster after a sweet-spot hit. */
  sweetGrowSec: 10,
  /** Run experiment: bonus Data for a sweet-spot hit. */
  sweetExperimentData: 2,
  /** Make media: bottles per powder by hand, and the bonus bottle. */
  mediaPerPowder: 3,
  sweetMedia: 1,
  /** Wash flask: after a hit the next wash takes this fraction of the time. */
  sweetWashNext: 0.5,
  /** New bin colour memo: taking out waste takes this much longer until the end of that day. */
  wasteRulesExtraSec: 3,
  /** Tidy up. */
  tidyBelow: 80,
  tidyGain: 40,
  sweetTidy: 10,
  /** Cleanliness lost per finished job in the room. */
  dirtPerJob: 2,
  /** Coffee break: the player works this much faster for a while. */
  coffee: { speedBonus: 0.1, seconds: 60 },
  /** Cultures. */
  contamination: {
    base: 0.05,
    dirtyRoomBelow: 50,
    dirtyRoomExtra: 0.05,
    /** No contamination among the first N cultures of a save. */
    safeCultures: 6,
  },
} as const;
