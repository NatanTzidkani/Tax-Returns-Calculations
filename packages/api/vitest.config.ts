import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // App boot + real-Postgres integration tests run on a slow bind-mounted
    // filesystem in the dev container; the vitest defaults (5s/10s) flake.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
