import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/core/types.ts'],
      thresholds: {
        branches: 95,
        lines: 95,
        functions: 100,
      },
    },
  },
});
