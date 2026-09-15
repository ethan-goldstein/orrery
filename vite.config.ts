import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { staticRoutes } from './tooling/vite-plugin-static-routes.ts';
import { VitePWA } from 'vite-plugin-pwa';
import { ROUTES } from './src/app/route-list.ts';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    staticRoutes(ROUTES),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Orrery',
        short_name: 'Orrery',
        description: 'An atlas of worlds. Earth, the Moon and the Solar System rendered from real ephemerides.',
        theme_color: '#04060b',
        background_color: '#04060b',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app shell is precached; heavy textures and datasets are cached on first use
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/textures/**', '**/data/**', '**/icons/**'],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          // manifests and JSON indexes change between deploys: always try the network first
          { urlPattern: /\/(textures\/manifest\.json|data\/.*\.json)$/, handler: 'NetworkFirst', options: { cacheName: 'orrery-indexes', networkTimeoutSeconds: 4, expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
          // texture and binary data files are content-stable: cache first
          { urlPattern: /\/(textures|data)\/.*\.(ktx2|webp|avif|png|jpg|bin)$/, handler: 'CacheFirst', options: { cacheName: 'orrery-assets', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 } } },
          { urlPattern: /\/basis\//, handler: 'CacheFirst', options: { cacheName: 'orrery-basis', expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 90 } } },
        ],
      },
    }),
  ],
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
