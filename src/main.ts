import { createHost } from './host';
import { createInitialState } from './sim/createState';
import { createGame } from './view/game';
import { mountUiRoot } from './ui/root';
import { mountStationPrompt } from './ui/stationPrompt';
import { mountStockStrip } from './ui/stockStrip';
import { mountTodoNote } from './ui/todoNote';
import { mountToasts } from './ui/toast';
import { mountTopBar } from './ui/topBar';

// Wires the layers together: platform, sim, view and ui.
const seed = Math.floor(Math.random() * 0x100000000);
const host = createHost(createInitialState(seed));

const gameParent = document.getElementById('game');
const uiRoot = document.getElementById('ui-root');
if (!gameParent || !uiRoot) throw new Error('index.html is missing #game or #ui-root');

const game = createGame(gameParent, host);
mountUiRoot(uiRoot, game);
mountTopBar(uiRoot, host);
mountStockStrip(uiRoot, host);
mountTodoNote(uiRoot, host);
mountStationPrompt(uiRoot, host);
mountToasts(uiRoot, host);

// Read-only debug handle for browser smoke tests: `window.__labwarming.state`.
(window as unknown as { __labwarming: unknown }).__labwarming = host;
(window as unknown as { __labwarmingGame: unknown }).__labwarmingGame = game;
