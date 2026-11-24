import type { GameHost } from '../host';
import { addNote, makeNote, type Face } from '../platform/feedback';
import { button, el } from './dom';
import { openModal } from './modal';

const FACES: Array<{ face: Face; label: string }> = [
  { face: 'like', label: 'Like' },
  { face: 'meh', label: 'Meh' },
  { face: 'dislike', label: 'Dislike' },
];

/** The note box (design doc 10). The game pauses while it is open. */
export function openFeedbackBox(root: HTMLElement, host: GameHost, recentEvents: () => string[]): void {
  const modal = openModal(root, host, { title: 'Leave a note' });
  const hint = el('p', 'modal__hint', 'What did you like, and what did you not? The note stays in this browser until you send it.');
  const ta = el('textarea', 'note__text');
  ta.rows = 5;
  ta.placeholder = 'Type here. The keys WASD and E will not move anything while you type.';
  ta.setAttribute('aria-label', 'Your note');
  const faces = el('div', 'note__faces');
  let chosen: Face | null = null;
  const buttons = FACES.map(({ face, label }) => {
    const b = button(label, 'btn note__face', () => {
      chosen = chosen === face ? null : face;
      buttons.forEach((x, i) => x.setAttribute('aria-pressed', String(FACES[i]?.face === chosen)));
    });
    b.setAttribute('aria-pressed', 'false');
    b.dataset['face'] = face;
    return b;
  });
  faces.append(...buttons);
  const err = el('div', 'modal__error');
  const save = button('Save note', 'btn btn--primary', () => {
    if (ta.value.trim() === '' && chosen === null) {
      err.textContent = 'Write something or pick a face first.';
      return;
    }
    const ok = addNote(makeNote(ta.value, chosen, host.state, recentEvents()));
    modal.close();
    host.events.emit({ type: 'Toast', text: ok ? 'Note saved. Thank you!' : 'Could not save the note in this browser window' });
  });
  const cancel = button('Cancel', 'btn', () => modal.close());
  const row = el('div', 'modal__actions');
  row.append(save, cancel);
  modal.body.append(hint, ta, faces, err, row);
  ta.focus();
}
