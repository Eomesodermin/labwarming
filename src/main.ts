import { createHost } from './host';
import { startAutosave } from './platform/autosave';
import { trackRecentEvents } from './platform/eventLog';
import { createGame } from './view/game';
import { mountChips } from './ui/chips';
import { mountEndOfDay } from './ui/endOfDay';
import { mountBuildPanel } from './ui/buildPanel';
import { openFeedbackBox } from './ui/feedbackBox';
import { openInbox } from './ui/inbox';
import { openLabPanel } from './ui/labPanel';
import { mountPartyCard } from './ui/partyCard';
import { mountUiRoot } from './ui/root';
import { openSettings } from './ui/settings';
import { openStaffPanel } from './ui/staffPanel';
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
  // Opening a panel on top of build mode ends build mode first.
  const openNote = (): void => {
    host.ui.setBuild(false);
    openFeedbackBox(uiRoot, host, recent);
  };
  const openMail = (): void => {
    host.ui.setBuild(false);
    openInbox(uiRoot, host);
  };
  const openSet = (): void => {
    host.ui.setBuild(false);
    openSettings(uiRoot, host);
  };
  const openStaff = (): void => {
    host.ui.setBuild(false);
    openStaffPanel(uiRoot, host);
  };
  const openLab = (tab: 'goals' | 'media' = 'goals'): void => {
    host.ui.setBuild(false);
    openLabPanel(uiRoot, host, tab);
  };
  host.ui.openLab = openLab;
  const toggleBuild = (): void => host.ui.setBuild(!host.ui.build.active);

  mountUiRoot(uiRoot, game);
  mountTopBar(uiRoot, host, { note: openNote, inbox: openMail, settings: openSet, build: toggleBuild, staff: openStaff, lab: () => openLab('goals') });
  mountStockStrip(uiRoot, host);
  mountTodoNote(uiRoot, host);
  mountChips(uiRoot, host);
  mountStationPrompt(uiRoot, host);
  mountStationMenu(uiRoot, host);
  mountToasts(uiRoot, host);
  mountBuildPanel(uiRoot, host);
  mountEndOfDay(uiRoot, host);
  mountPartyCard(uiRoot, host, openNote);
  mountStorageBanner(uiRoot);
  host.ui.panelKey = (code) => {
    if (code === 'KeyF') openNote();
    else if (code === 'KeyI') openMail();
    else if (code === 'KeyT') openStaff();
    else if (code === 'KeyL') openLab('goals');
    else if (code === 'KeyB') toggleBuild();
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
