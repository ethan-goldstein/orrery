import { defineConfig, devices } from '@playwright/test';

const base = process.env.BASE_PATH ?? '/';
const port = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: { timeout: process.env.CI ? 20_000 : 10_000 },
  use: {
    baseURL: `http://localhost:${port}${base}`,
    // CI has no GPU: force the low quality tier so software rendering keeps up
    storageState: process.env.CI
      ? { cookies: [], origins: [{ origin: `http://localhost:${port}`, localStorage: [{ name: 'orrery.settings.v1', value: JSON.stringify({ quality: 'low', labels: true, grain: false, units: 'metric' }) }] }] }
      : undefined,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH: base },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
