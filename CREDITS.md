# Credits

Everything in Labwarming is original and made for this project.

- **Art.** Every sprite, tile and icon is a text grid in `src/view/art/sprites/`, painted in code with the 16 colour palette in `src/view/art/palette.ts`. No images are downloaded or bundled.
- **Sound.** Every sound is generated at run time with the Web Audio API in `src/view/audio/sound.ts`. There are no sound files and no music.
- **Fonts.** None. The page uses the system font stack. Prices in the world use a 3 by 5 pixel digit font drawn from a text grid.
- **Code.** [Phaser 3](https://phaser.io) (MIT licence) draws the world. Vite, TypeScript and Vitest are build and test tools.
