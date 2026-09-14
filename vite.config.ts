import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { staticRoutes } from './tooling/vite-plugin-static-routes.ts';
import { ROUTES } from './src/app/route-list.ts';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), staticRoutes(ROUTES)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // satellite.js ships optional wasm/pthreads builds behind subpath imports; the pthreads
      // build references node:worker_threads, which the bundler cannot resolve for the browser.
      '#wasm-single-thread': fileURLToPath(new URL('./src/shims/empty-wasm.ts', import.meta.url)),
      '#wasm-multi-thread': fileURLToPath(new URL('./src/shims/empty-wasm.ts', import.meta.url)),
    },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (/node_modules[\\/]three[\\/]/.test(id)) return 'three';
          if (/node_modules[\\/]postprocessing[\\/]/.test(id)) return 'postprocessing';
          if (/node_modules[\\/]astronomy-engine[\\/]/.test(id)) return 'astronomy';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
