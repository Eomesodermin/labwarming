import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layer rule (design doc 8.2): sim and content never import view, ui, platform, Phaser or the DOM.
const forbiddenLayers = [
  'phaser',
  '**/view',
  '**/view/**',
  '**/ui',
  '**/ui/**',
  '**/platform',
  '**/platform/**',
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['*.config.js', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: forbiddenLayers, message: 'sim must not import view, ui, platform or Phaser.' }] },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'performance',
        'requestAnimationFrame',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'The sim has no real-time clock.' },
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: forbiddenLayers, message: 'content must not import view, ui, platform or Phaser.' },
            { group: ['**/sim/**', '!**/sim/types'], message: 'content may only import types from sim/types.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage'],
    },
  },
);
