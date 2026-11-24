// The sticky-note to-do list for the first six steps (design doc 12.2, milestone 2).
// Each step is ticked when its stat counter reaches the target.

export type TodoStat = 'splits' | 'readyCultures' | 'experiments' | 'washes' | 'mediaMade' | 'wasteTaken';

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
];
