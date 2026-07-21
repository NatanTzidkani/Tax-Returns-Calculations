import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Google Identity Services opens a sign-in popup that postMessages the
      // credential back to this window. The default COOP (`same-origin`) severs
      // that popup↔opener link ("Cross-Origin-Opener-Policy policy would block
      // the window.postMessage call"), so relax it to allow popups; COEP is
      // left unenforced so the cross-origin Google frames/scripts still load.
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
      proxy: {
        // The web app always calls `/api/*`; the API itself serves routes at
        // the root (`/tax-years`, `/documents/...`), so the prefix is stripped.
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      // Needed for @testing-library/react to register its afterEach cleanup.
      globals: true,
      // This repo's working tree sits on a slow Windows 9p mount; parallel
      // jsdom workers contend for CPU and make userEvent interaction tests
      // miss waitFor windows. Serial files + generous timeouts keep them
      // deterministic (the suite is small).
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: [
          // Test files and shared test harness — not product code.
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          // App entry point (bootstraps React into the DOM; no logic to test).
          'src/main.tsx',
          // Ambient type declarations — no runtime code.
          'src/**/*.d.ts',
          // Styles.
          'src/**/*.css',
        ],
        thresholds: {
          // Regression floor set just below the coverage measured when this
          // tooling landed (stmts 96.67 / branch 91.96 / funcs 87.67 /
          // lines 96.67, chore/web-coverage-tooling). This is a ratchet to
          // stop backsliding, NOT a bar that demands new tests today — raise
          // it as coverage improves.
          statements: 96,
          branches: 90,
          functions: 85,
          lines: 96,
        },
      },
    },
  };
});
