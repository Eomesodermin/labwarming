# Changelog

## Milestone 3: Money, orders, papers, saving and feedback

- Funds (start 500) and Reputation. Core funding of 100 arrives at the end of each day (18:00). The end-of-day card pauses the game until the player clicks Next day. Salaries join the card in milestone 5.
- Station menu: E at the desk opens a menu (write paper, revise paper, make presentation, write grant, three orders). E at a broken fridge opens a repair menu (150 Funds). Number keys or clicks pick an entry, Esc closes. Clicking a menu station walks there and opens its menu.
- Orders: assay kit box 40, media powder box 30, flask box 30, delivered after 30 s to the delivery bay. The bay is a station in the corridor at the bay marker. Put away order takes 6 s, adds what fits and leaves the rest of the box at the bay. A full store gives a reason (the broken fridge says to repair it).
- Fridge repair clears `broken`. Capacity then follows `tierStat('fridge', 'capacity')`.
- `fail_fridge_warm` as a toast at 13:00 while a fridge is broken, at most once a day, losing 1 media.
- Papers: write (50 Data, 20 s), 40 s review, Reviewer 2 letters in the inbox. Paper 1 is accepted, paper 2 needs a minor revision, later papers 60 percent accepted. Revising costs 10 Data and 8 s and then always accepts. Accepted papers pay 250 Funds and 10 Reputation. Make presentation (20 Data, 12 s, +8 Reputation).
- Seedling Grant: needs 1 accepted paper, written at the desk in 20 s, decided 30 s later (+1,200 Funds, +5 Reputation) with an email.
- Basic inbox (button, badge and key I) with the welcome email from Prof. Quince, paper letters and the grant decision.
- Save system (design doc 9): `sim/save/` has `serialize`, `deserialize`, `migrate` and `validate`. The platform layer adds the save envelope, the localStorage keys `labwarming.save` and `labwarming.save.backup`, autosave (end of day, every 60 s, tab hidden or closed, after purchases), the backup copy before each write, fallback to the backup, Export Broken Save and the storage-failure banner. Save codes use the `LABWARM1:` prefix. Settings has Save now, Copy save code, Download save file, Load save code (paste and file picker) and New Game with a second click to confirm.
- Title screen with Continue, New Game (confirms if a save exists) and Load save code.
- Feedback (design doc 10): Note button and key F, a note box with three faces that pauses the game, notes stored under `labwarming.feedback` with the context added automatically, and a Feedback tab in Settings with Copy all notes and Download notes. The email button only shows if `FEEDBACK_EMAIL` is set in `content/balance.ts`.
- All numbers live in `content/economy.ts`, `content/orders.ts`, `content/jobs.ts`, `content/events.ts` and `content/reviewer.ts`.

### Deviations

- `SCHEMA_VERSION` stays at 1. The save system first exists in this milestone, so there are no older saves. `MIGRATIONS` is empty. The migration runner is tested with injected steps, and a test checks there is one step per version below the current one.
- Put away order happens at the delivery bay, and the stock goes straight into the fridge or shelf. The walk with the box in hand is left for later. The bay is a 1 by 1 equipment piece (`bay`) at the bay marker facing right, so the existing station code handles it.
- Write grant is a desk job (20 s) that sends the next open grant. There is no separate `ApplyGrant` command. Only the Seedling Grant exists. The other two grants arrive in milestone 6.
- `PlaceOrder` and `RepairEquipment` only check Funds, not where the player stands. The menu is what limits them to the desk and the fridge. Orders are refused when Funds are below the price, including when Funds are negative (salaries and the negative-funds rule come in milestone 5, where this should be revisited: the doc says orders still work then).
- `fail_fridge_warm` is scripted, so it fires on Day 1 at 13:00 even though random failures wait 6 minutes. It is toast-only, with no email.
- The welcome email (`pi_welcome`) is in the inbox from the first tick. The director that fires it as a beat comes in milestone 6.
- The New Game and Import flows write the replaced save into the backup slot. The next autosave moves the newer game into the backup slot, as the doc's rotation says, so the backup is the previous save rather than a permanent copy. Players are told to use Copy save code first.
- A save that cannot be read is parked under `labwarming.save.broken` before the main slot is overwritten, so nothing is deleted silently.
- The game pauses while the end-of-day card, the note box, the inbox and Settings are open. The station menu does not pause.
- Scripted stats: `Stats` gained `ordersPlaced`, `papersWritten`, `presentations` and `boxesPutAway`.
- Game keys are ignored while a panel is open. `host.ui` carries that flag (never saved).
- `host.state` can be replaced as a whole (`replaceState`) for New Game and Load. The scene restarts when that happens.

## Milestone 2: Stations and hand-jobs

- Job system: jobs live in `state.jobs`, the player works one at a time. A job only progresses while the player stands in front of the station and faces it. Walking away pauses it and keeps progress. Esc stops it (progress kept too).
- Stock, cold and dry storage capacity (fridge, shelf), per-room waste bins, per-room Cleanliness (-2 per finished job, tidy up excluded).
- Cultures and incubator slots, 45 s growth, contamination rolls with the seeded RNG (never in the first 6, never twice in a row, +5% below Cleanliness 50, halved by a tier 2 hood).
- Hand-jobs: split cells, run experiment, make media, wash flask, take out waste, tidy up, bin a culture. One sweet-spot press per job.
- View: progress bars with the green zone, culture dots on the incubator, bin gauge, "!" mark on the broken fridge. UI: stock strip, station prompt with reasons, toasts ("Nice!"), sticky-note to-do list (six steps).
- Keys: E or Space uses the faced station (and is the sweet-spot press during a job), Q uses the station's second job (bench: make media), Esc stops. Clicking a station walks there and starts its first available job.
- Tier stats for bench, hood, incubator, fridge, shelf, sink and bin live in `content/equipment.ts`; job times and tuning in `content/jobs.ts`.

### Deviations

- Take out waste empties the bin in 4 s at the bin. The walk to the waste point and carrying a bag are left for later.
- The starting fridge is broken (capacity 8) as the doc says. Repair comes in M3, so for now it stays at 8.
- Make media needs 3 free cold spaces (the full yield), and the bonus bottle is clamped to free space.
- E on a station with several jobs picks the first available job; Q picks the second. No station menu yet.
- The sweet-spot zone start is random per job (seeded RNG), 22% wide.
- Fixed an M1 CSS bug: `calc(var(--u) * N)` had no unit, so the top bar height was ignored. It now uses `px`.
- `window.__labwarmingGame` exposes the Phaser game for browser smoke tests.
- Station prompt and toasts are HTML overlays; world bars are drawn with Phaser graphics.

## Milestone 1: Walking skeleton

- Project setup: Vite, TypeScript strict, Phaser 3.90.0 (pinned), Vitest, ESLint layer rules, DOM-free `tsconfig.sim.json`.
- Sim core: `GameState`, `createInitialState`, `step`, seeded RNG, clock, grid, tile movement, A* pathfinding with a path cache.
- The 30 by 20 map, the furnished starting Lab, five plots for sale.
- Walking by keys (WASD, arrows) and by clicking, camera follow (vertical), Stage A shapes.
- Top bar with day, time, pause and speed. P pauses, 1 and 2 set speed.
- GitHub Pages deploy workflow.

### Deviations

- Phaser 4 is the newest release on npm, so the last 3.x (3.90.0) is pinned as the doc asks.
- `clock.resumeSpeed` was added so Pause resumes at the previous speed.
- While paused, `step` handles commands but does not advance the tick.
- The shelf is rotated (faces left, 1 by 2 tiles at (9,4)) so it fits inside the Lab.
- `window.__labwarming` exposes the host for browser smoke tests.
- Vite 8 no longer accepts object `manualChunks`, so Phaser is in the main bundle (about 330 kB gzip).
