# Labwarming

Labwarming is a cozy browser game about a postdoc with one small room, a humming fridge and a PI who emails from airports. You split cells, run experiments, write papers and win grants, and the tiny lab grows into a corner of a research building. The design lives in `docs/design-doc.md`.

**Play it:** https://eomesodermin.github.io/labwarming/

## How to play

- **Walk** with `W` `A` `S` `D` or the arrow keys, or click where you want to go.
- **Use a machine** by standing in front of it and pressing `E`. `Q` runs a station's second job. Press `E` again in the green zone of the progress bar for a bonus. `Esc` stops a job.
- **Build** rooms and equipment with `B`. Hover over anything to see its name.
- `P` pauses, `1` and `2` set the speed, `I` opens the inbox, `T` staff, `L` your goals, `F` leaves a note for the developers, `M` turns sound on or off.
- Follow the to-do note at the bottom left for the first twelve minutes or so. The game saves itself in your browser. Settings has a save code you can copy to another device.

## Running it locally

Run `npm install` once, then `npm run dev` to start the dev server, `npm test` to run the unit tests and the pacing bots, `npm run lint`, `npm run typecheck` and `npm run build` to make the static build in `dist`.

## Publishing (one-time setup)

The workflow in `.github/workflows/deploy.yml` publishes every push to `main`. Before the first run, open the repository on GitHub, go to Settings, then Pages, and set Source to "GitHub Actions". After that, pushing to `main` updates the live link above.

Art and sound are original, see `CREDITS.md`.
