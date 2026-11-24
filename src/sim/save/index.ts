import { SCHEMA_VERSION } from '../../content/balance';
import type { GameState } from '../types';
import { SaveError, migrate } from './migrate';
import { validateState } from './validate';

export { SaveError } from './migrate';
export { validateState } from './validate';

/** The state as text. The platform layer wraps it with the save time and build id. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Migrates and validates a state object that was saved at `version`. Throws a SaveError if it cannot. */
export function restoreState(raw: unknown, version: number): GameState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SaveError('The save is damaged: it is not an object');
  const migrated = migrate(raw as Record<string, unknown>, version);
  const state = validateState(migrated);
  if (state.schemaVersion !== SCHEMA_VERSION) throw new SaveError('The save has the wrong version after upgrading');
  return state;
}

export function deserialize(text: string): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('The save is not valid text');
  }
  const version = typeof raw === 'object' && raw !== null ? (raw as { schemaVersion?: unknown }).schemaVersion : undefined;
  return restoreState(raw, typeof version === 'number' ? version : Number.NaN);
}
