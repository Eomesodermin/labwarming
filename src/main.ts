import { createHost } from './host';
import { startAutosave } from './platform/autosave';
import { trackRecentEvents } from './platform/eventLog';
import { createGame } from './view/game';
import { mountEndOfDay } from './ui/endOfDay';
import { openFeedbackBox } from './ui/feedbackBox';
import { openInbox } from './ui/inbox';
import { mountUiRoot } from './ui/root';
import { openSettings } from './ui/settings';
import { mountStationMenu } from './ui/stationMenu';
import { mountStationPrompt } from './ui/stationPrompt';
import { mountStockStrip } from './ui/stockStrip';
import { mountStorageBanner } from './ui/storageBanner';
import { showTitleScreen } from './ui/titleScreen';
import { mountTodoNote } from './ui/todoNote';
import { mountToasts } from './ui/toast';
import { mountTopBar } from './ui/topBar';

// Wires the layers together: platform, sim, view and ui.
const gameParent = document.getElementById('game');
const uiRoot = document.getElementById('ui-root');
if (!gameParent || !uiRoot) throw new Error('index.html is missing #game or #ui-root');

void showTitleScreen().then((state) => {
  const host = createHost(state);
  const game = createGame(gameParent, host);
  const recent = trackRecentEvents(host);
  const openNote = (): void => openFeedbackBox(uiRoot, host, recent);
  const openMail = (): void => openInbox(uiRoot, host);
  const openSet = (): void => openSettings(uiRoot, host);

  mountUiRoot(uiRoot, game);
  mountTopBar(uiRoot, host, { note: openNote, inbox: openMail, settings: openSet });
  mountStockStrip(uiRoot, host);
  mountTodoNote(uiRoot, host);
  mountStationPrompt(uiRoot, host);
  mountStationMenu(uiRoot, host);
  mountToasts(uiRoot, host);
  mountEndOfDay(uiRoot, host);
  mountStorageBanner(uiRoot);
  host.ui.panelKey = (code) => {
    if (code === 'KeyF') openNote();
    else if (code === 'KeyI') openMail();
    else return false;
    return true;
  };

  host.saving = true;
  const saveNow = startAutosave(host);

  // Read-only debug handles for browser smoke tests.
  const w = window as unknown as Record<string, unknown>;
  w['__labwarming'] = host;
  w['__labwarmingGame'] = game;
  w['__labwarmingSave'] = saveNow;
});
