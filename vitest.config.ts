import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Minimal Vitest configuration for the additive drawer data layer (Phase 2).
//
// - `tsconfigPaths()`: resolves the `@/*` path alias from tsconfig (this config
//   file is used instead of vite.config.ts, so the app's alias is not inherited).
// - `environment: 'node'`: the repository is framework-agnostic and touches no
//   DOM, so the lighter Node environment is sufficient (Dexie runs on the
//   IndexedDB global provided below).
// - `setupFiles: ['fake-indexeddb/auto']`: installs an in-memory IndexedDB
//   implementation onto the global scope before any test runs, so Dexie has a
//   backing store without a browser.
// - `include`: scoped to the framework-agnostic layers (the drawer/board lib and the
//   pure-logic hooks) so this config cannot accidentally pick up component tests that
//   would need a DOM environment.
export default defineConfig({
   plugins: [tsconfigPaths()],
   test: {
      environment: 'node',
      setupFiles: ['fake-indexeddb/auto'],
      include: ['src/lib/**/*.test.ts', 'src/hooks/**/*.test.ts'],
   },
});
