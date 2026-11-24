// The sticky-note to-do list: it guides the first 12 minutes, through the first hire (design doc 12.2, milestones 2 and 7).
// Each step is ticked when its stat reaches the target. The note shows the step to do now, the one before and the next.

export type TodoStat =
  | 'splits'
  | 'readyCultures'
  | 'experiments'
  | 'washes'
  | 'mediaMade'
  | 'wasteTaken'
  | 'fridgeRepaired'
  | 'ordersPlaced'
  | 'boxesPutAway'
  | 'requestsDone'
  | 'papersWritten'
  | 'seedlingApplied'
  | 'plotsBought'
  | 'hires';

export interface TodoStep {
  id: string;
  text: string;
  hint: string;
  stat: TodoStat;
  target: number;
}

export const TODO_STEPS: readonly TodoStep[] = [
  { id: 'split', text: 'Split some cells', hint: 'Walk to the hood and press E.', stat: 'splits', target: 1 },
  {
    id: 'grow',
    text: 'Let a culture grow',
    hint: 'Watch the incubator. A gold dot means ready.',
    stat: 'readyCultures',
    target: 1,
  },
  { id: 'experiment', text: 'Run an experiment', hint: 'Bench: press E for your first Data.', stat: 'experiments', target: 1 },
  { id: 'wash', text: 'Wash the dirty flask', hint: 'The sink turns it clean again.', stat: 'washes', target: 1 },
  { id: 'media', text: 'Make some media', hint: 'At the bench, press Q (or E when no culture is ready).', stat: 'mediaMade', target: 1 },
  { id: 'waste', text: 'Take out the waste', hint: 'Waste bin: press E.', stat: 'wasteTaken', target: 1 },
  { id: 'fridge', text: 'Repair the fridge', hint: 'The humming one. Press E there and pick Repair (150).', stat: 'fridgeRepaired', target: 1 },
  { id: 'order', text: 'Order assay kits', hint: 'Desk: press E, then the Assay kit box.', stat: 'ordersPlaced', target: 1 },
  { id: 'putaway', text: 'Put the box away', hint: 'Bodo leaves it at the delivery bay in the corridor. Press E there.', stat: 'boxesPutAway', target: 1 },
  { id: 'request', text: 'Help Prof. Quince', hint: 'Press I for the inbox. Her email on Day 2 asks for 3 experiments.', stat: 'requestsDone', target: 1 },
  { id: 'paper', text: 'Write your first paper', hint: 'Desk: press E, then Write paper. It uses 50 Data.', stat: 'papersWritten', target: 1 },
  { id: 'seedling', text: 'Apply for the Seedling Grant', hint: 'Desk: press E, then Write grant. It pays 1,200.', stat: 'seedlingApplied', target: 1 },
  { id: 'room', text: 'Build a Wash-up Room', hint: 'Press B, click a plot for sale, choose Wash-up Room, then add an autoclave.', stat: 'plotsBought', target: 1 },
  { id: 'hire', text: 'Hire your first helper', hint: 'Press T, then the Hire tab. A Wash-up crew member is cheap.', stat: 'hires', target: 1 },
];
