import { FEEDBACK_EMAIL, TICKS_PER_SECOND } from '../content/balance';
import { roomsOwned, formatClock } from '../sim/selectors';
import type { GameState } from '../sim/types';
import { BUILD_ID } from './buildInfo';
import { storageGet, storageSet } from './storage';

export const FEEDBACK_KEY = 'labwarming.feedback';

export type Face = 'like' | 'meh' | 'dislike';

export interface FeedbackNote {
  text: string;
  face: Face | null;
  /** ISO real time. */
  at: string;
  playSeconds: number;
  day: number;
  time: string;
  build: string;
  funds: number;
  reputation: number;
  rooms: number;
  staff: number;
  lastEvents: string[];
}

export function loadNotes(): FeedbackNote[] {
  const raw = storageGet(FEEDBACK_KEY);
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? (list.filter((n) => typeof n === 'object' && n !== null) as FeedbackNote[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: FeedbackNote[]): boolean {
  return storageSet(FEEDBACK_KEY, JSON.stringify(notes));
}

/** Makes a note with the game context filled in automatically. */
export function makeNote(text: string, face: Face | null, state: GameState, lastEvents: string[]): FeedbackNote {
  return {
    text: text.trim(),
    face,
    at: new Date().toISOString(),
    playSeconds: Math.round(state.tick / TICKS_PER_SECOND),
    day: state.clock.day,
    time: formatClock(state),
    build: BUILD_ID,
    funds: state.funds,
    reputation: state.reputation,
    rooms: roomsOwned(state),
    staff: Object.values(state.agents).filter((a) => a.kind !== 'player').length,
    lastEvents: lastEvents.slice(-5),
  };
}

export function addNote(note: FeedbackNote): boolean {
  const all = loadNotes();
  all.push(note);
  return saveNotes(all);
}

export function formatPlayTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

const FACE_WORDS: Record<Face, string> = { like: 'liked it', meh: 'meh', dislike: 'did not like it' };

/** The plain-text report: a three-line summary, then every note. */
export function buildReport(notes: FeedbackNote[]): string {
  const last = notes[notes.length - 1];
  const lines = [
    `Labwarming playtest notes. Build ${last?.build ?? BUILD_ID}`,
    `Total play time at the last note: ${last ? formatPlayTime(last.playSeconds) : 'no notes yet'}`,
    'Checklist goals reached: the Lab Warming list arrives in a later build',
    '',
  ];
  notes.forEach((n, i) => {
    lines.push(`Note ${i + 1} (${n.face ? FACE_WORDS[n.face] : 'no face'}) at ${n.at}`);
    lines.push(`Play time ${formatPlayTime(n.playSeconds)}, Day ${n.day} ${n.time}, build ${n.build}`);
    lines.push(`Funds ${n.funds}, Reputation ${n.reputation}, rooms ${n.rooms}, staff ${n.staff}`);
    lines.push(`Recent events: ${n.lastEvents.length ? n.lastEvents.join(', ') : 'none'}`);
    lines.push(n.text || '(no text)');
    lines.push('');
  });
  return lines.join('\n');
}

export function feedbackEmailEnabled(): boolean {
  return FEEDBACK_EMAIL.length > 0;
}

/** A mailto: link with the report cut to 1,800 characters. */
export function mailtoLink(notes: FeedbackNote[]): string {
  const body = buildReport(notes).slice(0, 1800);
  return `mailto:${encodeURIComponent(FEEDBACK_EMAIL)}?subject=${encodeURIComponent('Labwarming playtest notes')}&body=${encodeURIComponent(body)}`;
}
