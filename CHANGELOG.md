# Changelog

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
