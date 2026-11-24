# Changelog

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
