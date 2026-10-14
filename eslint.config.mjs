import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

// `src/` runs on Zapier's platform inside a user's Zap, with that user's beliq
// API key. So the security plugin runs at `error`, not at its own recommended
// `warn`, and `npm run lint` allows no warning either (`--max-warnings 0`).
export default defineConfig(
  {
    // `build/` is what `zapier-platform build` writes.
    ignores: ['dist/', 'build/', 'node_modules/'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      // The rules that need types read them through `tsconfig.eslint.json`, the
      // one program that holds every file the typed rules read: src/, test/,
      // the root config files and, through `allowJs`, this file. `tsc` does
      // not check that JavaScript (`checkJs` is off); it types it.
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Every `security/*` rule is a gate, not a note.
      ...Object.fromEntries(
        Object.keys(security.rules).map((r) => [`security/${r}`, 'error']),
      ),
      '@typescript-eslint/no-explicit-any': 'error',
      // The next three need types. A promise that is left floating, or handed
      // to a callback that drops it, loses its rejection. A `switch` over a
      // union names every member, and a `default` does not stand in for one.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // A leading underscore marks a parameter that is unused on purpose, as
      // `noUnusedParameters` of `tsconfig.json` reads it.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // `index.js` is the one CommonJS file: Zapier's runtime loads it from the
    // deploy root with `require`, and it hands on the built `dist/index.js`.
    // In the typed program that `require` would pull all of `dist/` in beside
    // `src/`, so this file is linted without types.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { sourceType: 'commonjs' },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // The hard caps on size and complexity, each an error. Split a function or a file that goes
    // over one. Do not raise a value here, put an `eslint-disable` or an inline `/* eslint */`
    // config on one of these rules, or run ESLint's `--suppress-all` or `--suppress-rule`,
    // which would start an eslint-suppressions.json. Function length counts code lines only,
    // and file length counts every line.
    rules: {
      complexity: ['error', 25],
      'max-lines-per-function': [
        'error',
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      'max-depth': ['error', 4],
      'max-params': ['error', 6],
      'max-lines': ['error', 1000],
    },
  },
  {
    // A `describe` or `it` callback is a function, so in a test file the length cap would
    // measure a whole suite. Every other cap holds there, file length included.
    files: ['test/**', '**/*.test.{ts,mts,cts,js,mjs,cjs}'],
    rules: { 'max-lines-per-function': 'off' },
  },
);
