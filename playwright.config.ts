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
  },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH: base },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
    // the other engines run a cross-browser subset: boot, shell, instruments, camera basics
    // headless Firefox on Linux has WebGL off unless forced onto its software path; both engines get more time on a software GPU
    {
      name: 'firefox',
      timeout: 120_000,
      use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false, 'webgl.forbid-software': false, 'gfx.webrender.software': true, 'layers.acceleration.force-enabled': true } } },
      testMatch: /(smoke|home|instruments|hint|phone)\.spec\.ts/,
    },
    { name: 'webkit', timeout: 120_000, use: { ...devices['Desktop Safari'] }, testMatch: /(smoke|home|instruments|hint|phone)\.spec\.ts/ },
  ],
});
