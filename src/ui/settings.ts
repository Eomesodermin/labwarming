import type { GameHost } from '../host';
import { copyText, downloadText, readFileText } from '../platform/files';
import {
  buildReport,
  feedbackEmailEnabled,
  formatPlayTime,
  loadNotes,
  mailtoLink,
  type FeedbackNote,
} from '../platform/feedback';
import { exportCode, parseCode, writeSave } from '../platform/saveStore';
import { SaveError } from '../sim/save';
import { button, el, esc } from './dom';
import { openModal } from './modal';
import { freshGame, swapGame } from './session';

const FACE_WORDS = { like: 'Liked it', meh: 'Meh', dislike: 'Did not like it' } as const;

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Settings: the game tab (save, export, import, new game) and the feedback tab (design doc 9 and 10). */
export function openSettings(root: HTMLElement, host: GameHost, tab: 'game' | 'feedback' = 'game'): void {
  const modal = openModal(root, host, { title: 'Settings', wide: true });
  const tabs = el('div', 'tabs');
  const content = el('div', 'tabs__content');
  const tabGame = button('Game', 'btn tab', () => show('game'));
  const tabFb = button('Feedback', 'btn tab', () => show('feedback'));
  tabGame.dataset['tab'] = 'game';
  tabFb.dataset['tab'] = 'feedback';
  tabs.append(tabGame, tabFb);
  modal.body.append(tabs, content);

  const show = (which: 'game' | 'feedback'): void => {
    tabGame.setAttribute('aria-pressed', String(which === 'game'));
    tabFb.setAttribute('aria-pressed', String(which === 'feedback'));
    content.innerHTML = '';
    if (which === 'game') gameTab(content);
    else feedbackTab(content);
  };

  function gameTab(c: HTMLElement): void {
    const msg = el('div', 'modal__msg');
    msg.setAttribute('role', 'status');
    const say = (text: string, bad = false): void => {
      msg.textContent = text;
      msg.classList.toggle('modal__msg--bad', bad);
    };
    const codeBox = el('textarea', 'note__text note__text--code');
    codeBox.rows = 3;
    codeBox.readOnly = true;
    codeBox.hidden = true;
    codeBox.setAttribute('aria-label', 'Your save code');

    const saveNow = button('Save now', 'btn', () => say(writeSave(host.state) ? 'Saved in this browser.' : 'This browser window cannot store a save. Use Copy save code.', !host.saving));
    const copy = button('Copy save code', 'btn', async () => {
      const code = exportCode(host.state);
      if (await copyText(code)) {
        say('Save code copied. Keep it somewhere safe.');
        codeBox.hidden = true;
      } else {
        codeBox.value = code;
        codeBox.hidden = false;
        codeBox.select();
        say('Could not reach the clipboard. Select the code below and copy it yourself.', true);
      }
    });
    const download = button('Download save file', 'btn', () => {
      downloadText('labwarming-save.txt', exportCode(host.state));
      say('Save file downloaded.');
    });

    const load = el('div', 'settings__group');
    load.innerHTML = '<h3>Load save code</h3>';
    const paste = el('textarea', 'note__text note__text--code');
    paste.rows = 3;
    paste.placeholder = 'Paste a code that starts with LABWARM1:';
    paste.setAttribute('aria-label', 'Paste a save code');
    const doLoad = (text: string): void => {
      try {
        const parsed = parseCode(text);
        swapGame(host, parsed.state);
        modal.close();
        host.events.emit({ type: 'Toast', text: 'Save loaded' });
      } catch (e) {
        say(e instanceof SaveError ? e.message : 'That save code could not be read', true);
      }
    };
    const loadBtn = button('Load this code (replaces the current game)', 'btn', () => doLoad(paste.value));
    const file = el('input');
    file.type = 'file';
    file.accept = '.txt,text/plain';
    file.setAttribute('aria-label', 'Pick a save file');
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (f) doLoad(await readFileText(f));
    });
    load.append(paste, el('div', 'modal__actions'), file);
    (load.children[2] as HTMLElement).append(loadBtn);

    let armed = false;
    const fresh = button('New game', 'btn btn--danger', () => {
      if (!armed) {
        armed = true;
        fresh.textContent = 'Really start over? Click again';
        say('Your current game is kept as the backup save. Copy the save code first to be safe.');
        setTimeout(() => {
          armed = false;
          fresh.textContent = 'New game';
        }, 6000);
        return;
      }
      swapGame(host, freshGame());
      modal.close();
      host.events.emit({ type: 'Toast', text: 'A fresh lab. Good luck!' });
    });

    const row1 = el('div', 'modal__actions');
    row1.append(saveNow, copy, download);
    const row2 = el('div', 'modal__actions');
    row2.append(fresh);
    c.append(row1, codeBox, load, row2, msg);
  }

  function feedbackTab(c: HTMLElement): void {
    const notes: FeedbackNote[] = loadNotes();
    const msg = el('div', 'modal__msg');
    msg.setAttribute('role', 'status');
    const actions = el('div', 'modal__actions');
    const copyAll = button('Copy all notes', 'btn', async () => {
      msg.textContent = (await copyText(buildReport(notes))) ? 'Copied. Paste it into a chat or an email.' : 'Could not reach the clipboard. Use Download notes instead.';
    });
    const dl = button('Download notes', 'btn', () => {
      downloadText(`labwarming-feedback-${stamp()}.txt`, buildReport(notes));
      msg.textContent = 'Notes downloaded.';
    });
    actions.append(copyAll, dl);
    if (feedbackEmailEnabled()) {
      actions.append(
        button('Email notes', 'btn', () => {
          window.location.href = mailtoLink(notes);
        }),
      );
    }
    const list = el('div', 'fb__list');
    if (notes.length === 0) list.innerHTML = '<p class="modal__hint">No notes yet. Press F in the game to leave one.</p>';
    notes.forEach((n, i) => {
      const item = el('div', 'fb__note');
      item.innerHTML = `<div class="fb__meta">Note ${i + 1} &middot; ${n.face ? FACE_WORDS[n.face] : 'no face'} &middot; Day ${n.day} ${esc(n.time)} &middot; ${formatPlayTime(n.playSeconds)} played</div><div class="fb__text">${esc(n.text || '(no text)')}</div>`;
      list.appendChild(item);
    });
    const summary = el('pre', 'fb__summary');
    if (notes.length > 0) summary.textContent = buildReport(notes).split('\n').slice(0, 3).join('\n');
    c.append(actions, msg, summary, list);
  }

  show(tab);
}
