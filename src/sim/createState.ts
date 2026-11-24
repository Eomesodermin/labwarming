import { DEFAULT_PLAYER_NAME, SCHEMA_VERSION } from '../content/balance';
import { STARTING_FUNDS, STARTING_REPUTATION } from '../content/economy';
import { START_STOCK } from '../content/items';
import { PLAYER_START, PLOTS, START_EQUIPMENT, START_PLOT } from '../content/map';
import { PLAYER_ID } from './commands';
import { sendEmailRow } from './email';
import { seedToState } from './rng';
import type { Equipment, GameState, Plot } from './types';

export function createInitialState(seed: number): GameState {
  const plots: Record<string, Plot> = {};
  for (const p of PLOTS) {
    const start = p.id === START_PLOT;
    plots[p.id] = { id: p.id, owned: start, roomType: start ? 'lab' : null, cleanliness: 100, waste: 0 };
  }

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: seedToState(seed),
    tick: 0,
    clock: { day: 1, tickOfDay: 0, speed: 1, resumeSpeed: 1 },
    playerName: DEFAULT_PLAYER_NAME,
    funds: STARTING_FUNDS,
    data: 0,
    reputation: STARTING_REPUTATION,
    papers: [],
    presentations: 0,
    grants: {},
    orders: [],
    boxes: [],
    inbox: [],
    stock: { ...START_STOCK },
    plots,
    equipment: {},
    jobs: {},
    cultures: [],
    stats: { ordersPlaced: 0, papersWritten: 0, presentations: 0, boxesPutAway: 0, splits: 0, culturesGrown: 0, experiments: 0, washes: 0, mediaMade: 0, wasteTaken: 0, tidies: 0, binned: 0, sweetHits: 0 },
    agents: {
      [PLAYER_ID]: {
        id: PLAYER_ID,
        kind: 'player',
        x: PLAYER_START.x,
        y: PLAYER_START.y,
        facing: PLAYER_START.facing,
        path: [],
        moveProgress: 0,
        arriveFacing: null,
        jobId: null,
        pendingStation: null,
      },
    },
    gridVersion: 1,
    flags: {},
    nextId: 1,
  };

  for (const e of START_EQUIPMENT) {
    const id = `eq${state.nextId++}`;
    const eq: Equipment = { id, defId: e.defId, tier: e.tier, x: e.x, y: e.y, rot: e.rot, broken: e.broken === true };
    state.equipment[id] = eq;
  }
  sendEmailRow(state, 'pi_welcome');
  return state;
}
