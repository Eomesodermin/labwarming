import { SaveError, restoreState } from '../sim/save';
import type { GameState } from '../sim/types';
import { BUILD_ID } from './buildInfo';
import { storageGet, storageRemove, storageSet } from './storage';

export const SAVE_KEY = 'labwarming.save';
export const BACKUP_KEY = 'labwarming.save.backup';
/** A save that could not be read is parked here before it would be overwritten. Never deleted by the game. */
export const BROKEN_KEY = 'labwarming.save.broken';

export const CODE_PREFIX = 'LABWARM1:';

export interface ParsedSave {
  state: GameState;
  savedAt: string;
  build: string;
}

/** The text of a save: the version, the real time, the build id and the state. */
export function makeSaveText(state: GameState): string {
  return JSON.stringify({ schemaVersion: state.schemaVersion, savedAt: new Date().toISOString(), build: BUILD_ID, state });
}

/** Parses, migrates and validates save text. Throws a SaveError with a message the player can read. */
export function parseSave(text: string): ParsedSave {
  let env: unknown;
  try {
    env = JSON.parse(text);
  } catch {
    throw new SaveError('The save is not valid text');
  }
  if (typeof env !== 'object' || env === null) throw new SaveError('The save is damaged: it is not an object');
  const e = env as { schemaVersion?: unknown; savedAt?: unknown; build?: unknown; state?: unknown };
  if (typeof e.schemaVersion !== 'number') throw new SaveError('The save has no version number');
  const state = restoreState(e.state, e.schemaVersion);
  return { state, savedAt: typeof e.savedAt === 'string' ? e.savedAt : '', build: typeof e.build === 'string' ? e.build : '' };
}

function isReadable(text: string | null): boolean {
  if (!text) return false;
  try {
    parseSave(text);
    return true;
  } catch {
    return false;
  }
}

/** Writes the save. The previous save is copied to the backup first. Returns false if storage refused. */
export function writeSave(state: GameState): boolean {
  const prev = storageGet(SAVE_KEY);
  if (prev) {
    if (isReadable(prev)) storageSet(BACKUP_KEY, prev);
    else storageSet(BROKEN_KEY, prev); // keep it, never delete data silently
  }
  return storageSet(SAVE_KEY, makeSaveText(state));
}

export type LoadOutcome =
  | { kind: 'none' }
  | { kind: 'ok'; save: ParsedSave; fromBackup: boolean }
  | { kind: 'broken'; mainText: string | null; backupText: string | null; reason: string };

/** Reads the main save, then the backup. If both fail the raw text is handed back so it can be exported. */
export function readSave(): LoadOutcome {
  const main = storageGet(SAVE_KEY);
  const backup = storageGet(BACKUP_KEY);
  if (main === null && backup === null) return { kind: 'none' };
  let reason = 'No save could be read.';
  if (main !== null) {
    try {
      return { kind: 'ok', save: parseSave(main), fromBackup: false };
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  if (backup !== null) {
    try {
      return { kind: 'ok', save: parseSave(backup), fromBackup: true };
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  return { kind: 'broken', mainText: main, backupText: backup, reason };
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** The save code: the save text, base64 encoded, with the LABWARM1: prefix. Also the content of the save file. */
export function exportCode(state: GameState): string {
  return CODE_PREFIX + toBase64(makeSaveText(state));
}

/** Checks the prefix, decodes, migrates and validates. Never touches the stored save. */
export function parseCode(code: string): ParsedSave {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(CODE_PREFIX)) throw new SaveError('That is not a Labwarming save code. It should start with LABWARM1:');
  let text: string;
  try {
    text = fromBase64(trimmed.slice(CODE_PREFIX.length));
  } catch {
    throw new SaveError('The save code is damaged and cannot be decoded');
  }
  return parseSave(text);
}

/** Replaces the current save with an imported or new one. The replaced save becomes the backup. */
export function replaceSave(state: GameState): boolean {
  return writeSave(state);
}

export function hasSave(): boolean {
  return storageGet(SAVE_KEY) !== null || storageGet(BACKUP_KEY) !== null;
}

export function clearBrokenCopy(): void {
  storageRemove(BROKEN_KEY);
}
