import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/sim/createState';
import { serialize } from '../../src/sim/save';
import {
  BACKUP_KEY,
  BROKEN_KEY,
  CODE_PREFIX,
  SAVE_KEY,
  exportCode,
  parseCode,
  parseSave,
  readSave,
  writeSave,
} from '../../src/platform/saveStore';
import { FEEDBACK_KEY, addNote, buildReport, loadNotes, makeNote } from '../../src/platform/feedback';
import { storageFailed } from '../../src/platform/storage';

class FakeStorage {
  data = new Map<string, string>();
  throwOnSet = false;
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.throwOnSet) throw new Error('blocked');
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

let store: FakeStorage;
beforeEach(() => {
  store = new FakeStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: store };
});
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('save store', () => {
  it('writes and reads a save', () => {
    const s = createInitialState(5);
    s.funds = 1234;
    expect(writeSave(s)).toBe(true);
    const out = readSave();
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.save.state).toEqual(s);
      expect(out.fromBackup).toBe(false);
      expect(out.save.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('reports no save when nothing is stored', () => {
    expect(readSave().kind).toBe('none');
  });

  it('copies the previous save to the backup before each write', () => {
    const a = createInitialState(1);
    a.funds = 111;
    const b = createInitialState(2);
    b.funds = 222;
    writeSave(a);
    writeSave(b);
    expect(parseSave(store.getItem(BACKUP_KEY) ?? '').state.funds).toBe(111);
    expect(parseSave(store.getItem(SAVE_KEY) ?? '').state.funds).toBe(222);
  });

  it('falls back to the backup when the main save is damaged, and keeps the damaged text', () => {
    const a = createInitialState(1);
    a.funds = 111;
    writeSave(a);
    writeSave(createInitialState(2));
    store.setItem(SAVE_KEY, '{"broken":');
    const out = readSave();
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') expect(out.fromBackup).toBe(true);
    writeSave(createInitialState(3));
    expect(store.getItem(BROKEN_KEY)).toBe('{"broken":');
  });

  it('hands back the raw text when both saves are damaged', () => {
    store.setItem(SAVE_KEY, 'junk');
    store.setItem(BACKUP_KEY, 'more junk');
    const out = readSave();
    expect(out.kind).toBe('broken');
    if (out.kind === 'broken') {
      expect(out.mainText).toBe('junk');
      expect(out.backupText).toBe('more junk');
    }
    expect(store.getItem(SAVE_KEY)).toBe('junk'); // nothing was deleted
  });

  it('survives storage that refuses writes', () => {
    store.throwOnSet = true;
    expect(writeSave(createInitialState(1))).toBe(false);
    expect(storageFailed()).toBe(true);
  });
});

describe('save code', () => {
  it('round-trips through the LABWARM1: code, including non-ASCII text', () => {
    const s = createInitialState(9);
    s.playerName = 'Dr. Zoë Müller';
    s.funds = 4321;
    const code = exportCode(s);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(parseCode(code).state).toEqual(s);
    expect(parseCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `).state).toEqual(s);
  });

  it('rejects codes without the prefix, with bad base64 or with damaged contents', () => {
    expect(() => parseCode('hello')).toThrow(/LABWARM1/);
    expect(() => parseCode('LABWARM1:!!!not base64!!!')).toThrow(/damaged/);
    expect(() => parseCode(CODE_PREFIX + btoa('{"schemaVersion":1,"state":{}}'))).toThrow(/damaged/);
    expect(() => parseCode(CODE_PREFIX + btoa('plain text'))).toThrow(/not valid text/);
    expect(() => parseCode(CODE_PREFIX)).toThrow();
  });

  it('refuses a save from a newer version without touching the stored save', () => {
    const s = createInitialState(1);
    writeSave(s);
    const before = store.getItem(SAVE_KEY);
    const future = JSON.stringify({ schemaVersion: 99, state: JSON.parse(serialize(s)) });
    expect(() => parseCode(CODE_PREFIX + btoa(future))).toThrow(/newer version/);
    expect(store.getItem(SAVE_KEY)).toBe(before);
  });
});

describe('feedback notes', () => {
  it('stores notes apart from the save, with context, and builds a report', () => {
    const s = createInitialState(1);
    s.funds = 321;
    s.tick = 6000;
    addNote(makeNote('  Love the fridge  ', 'like', s, ['a', 'b', 'c', 'd', 'e', 'f']));
    addNote(makeNote('', 'meh', s, []));
    const notes = loadNotes();
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ text: 'Love the fridge', face: 'like', funds: 321, rooms: 1, staff: 0, playSeconds: 600 });
    expect(notes[0]?.lastEvents).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(store.getItem(FEEDBACK_KEY)).not.toBeNull();
    expect(store.getItem(SAVE_KEY)).toBeNull();
    const report = buildReport(notes);
    expect(report).toContain('Love the fridge');
    expect(report.split('\n').slice(0, 3).join('\n')).toMatch(/Build .*\n.*play time.*10 min 00 s\n.*goals/i);
  });

  it('copes with a damaged notes entry', () => {
    store.setItem(FEEDBACK_KEY, '{oops');
    expect(loadNotes()).toEqual([]);
  });
});
