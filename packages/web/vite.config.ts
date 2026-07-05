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
    },
  };
});
