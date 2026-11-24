import { copyText, downloadText, readFileText } from '../platform/files';
import { BUILD_ID } from '../platform/buildInfo';
import { BROKEN_KEY, hasSave, parseCode, readSave, writeSave, type LoadOutcome } from '../platform/saveStore';
import { storageGet } from '../platform/storage';
import { SaveError } from '../sim/save';
import type { GameState } from '../sim/types';
import { formatClock } from '../sim/selectors';
import { button, el, esc } from './dom';
import { freshGame } from './session';
import { mountStorageBanner } from './storageBanner';

/**
 * The title screen: Continue and New Game (design doc 9). Resolves with the state to play.
 * It writes the first save of a new or imported game, so the save it replaces becomes the backup.
 */
export function showTitleScreen(): Promise<GameState> {
  return new Promise((resolve) => {
    const outcome: LoadOutcome = readSave();
    const screen = el('div', 'title');
    const card = el('div', 'title__card');
    screen.appendChild(card);
    document.body.appendChild(screen);
    mountStorageBanner(screen);

    const finish = (state: GameState): void => {
      screen.remove();
      resolve(state);
    };

    const msg = el('div', 'modal__msg title__msg');
    msg.setAttribute('role', 'status');
    const say = (t: string, bad = false): void => {
      msg.textContent = t;
      msg.classList.toggle('modal__msg--bad', bad);
    };

    card.innerHTML = `<h1 class="title__name">Labwarming</h1><p class="title__tag">A cozy game about a postdoc and a very small lab.</p>`;
    const actions = el('div', 'title__actions');
    card.appendChild(actions);

    let armed = false;
    const newBtn = button('New Game', 'btn btn--big', () => {
      if (outcome.kind !== 'none' && hasSave() && !armed) {
        armed = true;
        newBtn.textContent = 'Really? Your old save is kept as the backup';
        return;
      }
      const state = freshGame();
      writeSave(state);
      finish(state);
    });

    if (outcome.kind === 'ok') {
      const s = outcome.save.state;
      const cont = button('Continue', 'btn btn--big btn--primary', () => finish(s));
      const detail = el('div', 'title__detail');
      detail.textContent = `Day ${s.clock.day}, ${formatClock(s)}. Funds ${s.funds}, Reputation ${s.reputation}.`;
      actions.append(cont, detail);
      if (outcome.fromBackup) say('Your latest save could not be read, so the backup was loaded.', true);
      queueMicrotask(() => cont.focus());
    }
    if (outcome.kind === 'broken') {
      say(`The save in this browser could not be read. ${outcome.reason}`, true);
      const text = outcome.mainText ?? outcome.backupText ?? storageGet(BROKEN_KEY) ?? '';
      const row = el('div', 'title__row');
      row.append(
        button('Copy broken save', 'btn', async () => {
          say((await copyText(text)) ? 'Broken save copied. Send it to Dillon, he may be able to fix it.' : 'Could not reach the clipboard. Use Download.', false);
        }),
        button('Download broken save', 'btn', () => downloadText('labwarming-broken-save.txt', text)),
      );
      card.appendChild(row);
    }
    actions.appendChild(newBtn);
    if (outcome.kind === 'none') queueMicrotask(() => newBtn.focus());

    // Load save code.
    const loadWrap = el('div', 'title__load');
    const toggle = button('Load save code', 'btn', () => {
      loadWrap.hidden = !loadWrap.hidden;
    });
    actions.appendChild(toggle);
    loadWrap.hidden = true;
    const paste = el('textarea', 'note__text note__text--code');
    paste.rows = 3;
    paste.placeholder = 'Paste a code that starts with LABWARM1:';
    paste.setAttribute('aria-label', 'Paste a save code');
    const doLoad = (text: string): void => {
      try {
        const parsed = parseCode(text);
        writeSave(parsed.state);
        finish(parsed.state);
      } catch (e) {
        say(e instanceof SaveError ? e.message : 'That save code could not be read', true);
      }
    };
    const file = el('input');
    file.type = 'file';
    file.accept = '.txt,text/plain';
    file.setAttribute('aria-label', 'Pick a save file');
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (f) doLoad(await readFileText(f));
    });
    const go = button('Load this code', 'btn', () => doLoad(paste.value));
    loadWrap.append(paste, go, file);
    card.append(loadWrap, msg);

    // How to play: short, friendly, and open for a first visit.
    const howto = el('details', 'howto');
    howto.open = outcome.kind !== 'ok';
    howto.innerHTML = `<summary>How to play</summary>
      <ul class="howto__list">
        <li><b>Walk</b> with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys. You can also click where you want to go.</li>
        <li><b>Use a machine</b> by standing in front of it and pressing <kbd>E</kbd>. A little prompt tells you what it does.</li>
        <li><b>Press <kbd>E</kbd> again in the green zone</b> of the progress bar for a bonus. <kbd>Esc</kbd> stops a job.</li>
        <li><b>Build</b> new rooms and equipment with <kbd>B</kbd>. Your to-do note tells you what to try first.</li>
        <li><kbd>P</kbd> pauses. Nothing is timed, so take it slowly. The game saves itself.</li>
      </ul>`;
    card.appendChild(howto);
    const foot = el('p', 'title__keys');
    foot.innerHTML = `<span class="title__build">Build ${esc(BUILD_ID)}</span>`;
    card.appendChild(foot);
  });
}
