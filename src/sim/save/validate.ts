import { SaveError } from './migrate';
import type { GameState } from '../types';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function need(cond: boolean, what: string): void {
  if (!cond) throw new SaveError(`The save is damaged: ${what}`);
}

/** Checks the required fields and their types. Returns the same object, typed. Throws a SaveError otherwise. */
export function validateState(raw: unknown): GameState {
  need(isObj(raw), 'it is not an object');
  const s = raw as Raw;
  for (const k of ['schemaVersion', 'seed', 'rngState', 'tick', 'funds', 'data', 'reputation', 'presentations', 'gridVersion', 'nextId']) {
    need(isNum(s[k]), `${k} must be a number`);
  }
  need(typeof s['playerName'] === 'string', 'playerName must be text');

  need(isObj(s['clock']), 'clock is missing');
  const clock = s['clock'] as Raw;
  need(isNum(clock['day']) && (clock['day'] as number) >= 1, 'clock.day');
  need(isNum(clock['tickOfDay']) && (clock['tickOfDay'] as number) >= 0, 'clock.tickOfDay');
  need([0, 1, 2].includes(clock['speed'] as number), 'clock.speed');
  need([1, 2].includes(clock['resumeSpeed'] as number), 'clock.resumeSpeed');

  need(isObj(s['stock']), 'stock is missing');
  for (const k of ['cleanFlasks', 'dirtyFlasks', 'media', 'assayKits', 'mediaPowder']) {
    need(isNum((s['stock'] as Raw)[k]), `stock.${k}`);
  }

  for (const k of ['plots', 'equipment', 'agents', 'jobs', 'grants', 'stats', 'flags']) need(isObj(s[k]), `${k} is missing`);
  for (const k of ['cultures', 'papers', 'orders', 'boxes', 'inbox']) need(Array.isArray(s[k]), `${k} is missing`);

  for (const p of Object.values(s['plots'] as Raw)) need(isObj(p) && isNum(p['cleanliness']) && isNum(p['waste']), 'a plot');
  for (const e of Object.values(s['equipment'] as Raw)) {
    need(isObj(e) && typeof e['defId'] === 'string' && isNum(e['x']) && isNum(e['y']) && isNum(e['tier']) && isNum(e['rot']), 'a piece of equipment');
  }
  const player = (s['agents'] as Raw)['player'];
  need(isObj(player) && isNum(player['x']) && isNum(player['y']) && Array.isArray(player['path']), 'the player');
  for (const j of Object.values(s['jobs'] as Raw)) {
    need(isObj(j) && typeof j['defId'] === 'string' && isNum(j['progressTicks']) && isNum(j['totalTicks']), 'a job');
  }
  for (const c of s['cultures'] as unknown[]) need(isObj(c) && isNum(c['growTicksLeft']) && typeof c['status'] === 'string', 'a culture');
  for (const p of s['papers'] as unknown[]) need(isObj(p) && isNum(p['number']) && typeof p['status'] === 'string', 'a paper');
  for (const o of s['orders'] as unknown[]) need(isObj(o) && typeof o['orderId'] === 'string' && isNum(o['ticksLeft']), 'an order');
  for (const b of s['boxes'] as unknown[]) need(isObj(b) && typeof b['orderId'] === 'string' && isNum(b['qty']), 'a box');
  for (const m of s['inbox'] as unknown[]) need(isObj(m) && typeof m['subject'] === 'string' && typeof m['body'] === 'string', 'an email');
  return s as unknown as GameState;
}
