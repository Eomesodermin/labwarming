# Changelog

## Milestone 5: Staff

- Hire panel and staff panel (button and key T, does not pause): three candidates per role refreshed each morning (drawn from their own seeded stream), traits, fees, salaries, lock reasons, Part ways with a confirm click. Live Energy, Mood and current job per person.
- Roles: technician (Reputation 10), wash-up crew (own a Wash-up Room), cleaner (own 2 rooms), up to 2 each. Numbers in `content/staff.ts`.
- Staff AI (`sim/systems/staff.ts`): idle staff think every 5 ticks, take the first available job in their role priority, nearest station by path first, and skip stations with no reachable front tile. No random numbers, so it is deterministic.
- Reservations: a job holds its station and inputs from the moment staff pick it. The player may take a station staff are only walking to (they pick again); a station where someone is working refuses with their name. Resource counts (flasks, cultures, kits and so on) include jobs in flight.
- Energy (-1 per 4 s of work, break at 20 or below after the current job), breaks (coffee machine job, 20 s or 12 s at tier 2, or 40 s resting in place without one), Mood formula and speed multiplier, all 8 traits.
- Salaries on the end-of-day card, per person, with the covered-by-Prof.-Quince line. Negative funds: floor -500; rooms, equipment, hires and repairs refused while negative; orders still work down to -500.
- Mood and break icons over heads (rain cloud, coffee cup). Stage A shapes per role.
- Save schema 3 with a 2 to 3 migration (agents get `staff`, state gets `candidates`) and tests. M4 saves load; their candidates are drawn on the first tick.
- Tests: `tests/sim/staff.test.ts` and migration tests in `save.test.ts`.

### Deviations and notes

- Coffee machine Mood is +10 at any tier (design doc 4.5); the tier 2 "Mood +10" in 4.2 is read as the same bonus. Content stat is now `[10, 10]`.
- PI request and cake Mood effects read `flags.piRequest` (true) and `flags.cakeTicks` (a countdown). Nothing sets them yet; M6 should set them and count `cakeTicks` down.
- Staff do not use sweet spots, toasts or the player's coffee boost. Staff jobs do not consume the `washBoost` flag.
- AI thresholds (not in the doc): the cleaner takes waste first at a half-full bin and the wash-up crew starts the autoclave first at 4 dirty flasks; otherwise those are fallbacks when idle. Without any sink the autoclave has no threshold.
- Without a technician or cleaner, a full bin can still stall experiments; that is the player's or a cleaner's job.
- Hiring also needs non-negative Funds. A hired person's name leaves the candidate pool while employed.
- Placement refuses tiles where any agent stands, not only the player.
- Notes for M6: staff idle at the entrance or wherever they finished; visitors, Prof. Quince and Tock can reuse `Agent` (add kinds). `EndOfDay` now carries `salaries`, `salaryTotal` and `covered`.

## Milestone 4: Build mode, rooms and upgrades

- Build mode (B or the Build button): pauses the game (kept paused even if Resume is pressed), zooms the map out to sit left of a side panel with Rooms, Equipment and Decor tabs, draws the tile grid, keep-clear marks on every door and the tile inside it, and room names.
- Buying plots: click a plot for sale, pick a room type. Costs and Reputation unlocks come from `content/rooms.ts`. The door opens, the floor takes the room's colour and a free spray station is placed beside the door. The Media Facility is listed but locked (needs Reputation 30, then says it opens in a later update).
- Placement (`sim/placement.ts`, rules from 3.2): inside an owned room that allows the item, free tiles, door and inside-door tile clear, someone standing there blocks, the front must have a free floor tile reachable from the door. The ghost is green or red with a one-line reason. Left click places, R or right click rotates, clicking a piece selects it for Move (free), Upgrade, Repair (fridge) or Sell.
- Commands: `BuyPlot`, `PlaceEquipment`, `MoveEquipment`, `SellEquipment`, `UpgradeEquipment`. All bump `gridVersion` when walkability changes and stop a player walk that would cross the new layout. Sell refunds 50 percent of everything paid including upgrades, and refuses if cultures, a running autoclave, stored stock or waste would be lost.
- All of 4.2 works: tier stats for every piece, upgrade prices and Reputation gates, desk writing speed (and Office plus 25 percent), autoclave (Run autoclave job 6 s, unattended cycle 40 s or 30 s, 8 or 16 flasks, flasks wait inside if the shelf is full), coffee machine (Coffee break job, then 10 percent faster work for 60 s), sofa and plant as decor.
- "No path" warning: equipment with no reachable front tile gets a pulsing red mark and a line in the panel (`pathWarnings`).
- Save schema is now 2. Migration 1 to 2 adds `equipment.cycle` (null) and `stats.autoclaveCycles` and `stats.plotsBought`. M3 saves load.
- Tests: `tests/sim/build.test.ts` and migration tests in `tests/sim/save.test.ts`.

### Deviations

- Esc drops a held item first, then a second Esc leaves build mode. B leaves at once.
- New items stay in hand after placing, so several can be placed in a row. Moving drops the piece after one placement.
- Sell asks for a second click to confirm.
- The autoclave never breaks in M4. The 5 percent breakdown, coaxing and the engineer arrive with the failure events in M6.
- Coffee break has no Energy or Mood yet (M5). The player only gets the speed boost. Tier 2 Mood and sofa and plant Mood are stored in content for M5.
- The media prep unit is not in the catalogue (the facility function is out of scope).
- Placement does not forbid cutting off another piece, so the warning can fire. Only the new piece's own front and the door must stay reachable.
- A second Lab costs 600. Room type cannot be changed after buying.
- Build mode zooms the camera to 0.75, so world text labels look soft there.
- Starting equipment (not the bay or spray) can be sold, for half its price.

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
