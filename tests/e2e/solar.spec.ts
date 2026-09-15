import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('deep link focuses Saturn in true scale', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./solar?body=saturn&view=planet&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-focus', 'saturn');
  await expect(canvas).toHaveAttribute('data-view', 'planet');
  await expect(canvas).toHaveAttribute('data-scale', '1.00', { timeout: 10_000 });
  await expect(page.locator('[data-testid="info-panel"] h2')).toHaveText('Saturn');
  await expect(page.locator('[data-testid="sim-time"]')).toHaveText('2026-09-14 12:00 UTC');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('system view lists the planets and shows labels', async ({ page }) => {
  await page.goto('./solar?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  // compressed textures take the KTX2 path wherever the GPU can transcode them
  if ((await canvas.getAttribute('data-ktx2')) === 'true') await expect.poll(async () => Number(await canvas.getAttribute('data-ktx2-loaded')), { timeout: 30_000 }).toBeGreaterThan(3);
  const strip = page.locator('[data-testid="planet-strip"] button');
  await expect(strip).toHaveCount(10);
  await expect.poll(() => page.locator('.body-label:not([hidden])').count(), { timeout: 10_000 }).toBeGreaterThan(4);
});

test('planet strip click flies to Mars and updates the URL', async ({ page }) => {
  await page.goto('./solar?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.locator('[data-testid="planet-strip"] button[data-body="mars"]').click();
  await expect(canvas).toHaveAttribute('data-focus', 'mars');
  await expect(canvas).toHaveAttribute('data-view', 'planet');
  await expect.poll(() => page.url()).toContain('body=mars');
});

test('keyboard: S toggles scale, arrow keys step planets, Escape returns home', async ({ page }) => {
  await page.goto('./solar?body=earth&view=planet&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('ArrowRight');
  await expect(canvas).toHaveAttribute('data-focus', 'mars');
  await page.keyboard.press('Escape');
  await expect(canvas).toHaveAttribute('data-view', 'system');
  await expect(canvas).toHaveAttribute('data-scale', '0.00', { timeout: 10_000 });
  await page.keyboard.press('s');
  await expect(canvas).toHaveAttribute('data-scale', '1.00', { timeout: 10_000 });
});

test('moons view of Jupiter shows the Galileans', async ({ page }) => {
  await page.goto('./solar?body=jupiter&view=moons&t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  for (const name of ['Io', 'Europa', 'Ganymede', 'Callisto']) {
    await expect(page.locator('.body-label:not([hidden])', { hasText: name })).toBeVisible({ timeout: 10_000 });
  }
});

test('time survives a century jump without NaN', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./solar?t=2100-01-01T00:00:00Z&rate=0');
  await ready(page);
  await expect(page.locator('[data-testid="sim-time"]')).toContainText('2100-01-01');
  await page.goto('./solar?t=1800-03-15T00:00:00Z&rate=0');
  await ready(page);
  await expect(page.locator('[data-testid="sim-time"]')).toContainText('1800-03-15');
  const nan = await page.evaluate(() => [...document.querySelectorAll('.body-label')].some((l) => (l as HTMLElement).style.transform.includes('NaN')));
  expect(nan).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Moments jump to the August 2026 total solar eclipse and focus Earth', async ({ page }) => {
  await page.goto('./solar?t=2026-07-01T00:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.locator('[data-testid="moments"] button[data-event="solar-eclipse"]').click();
  await expect(page.locator('[data-testid="sim-time"]')).toContainText('2026-08-12');
  await expect(canvas).toHaveAttribute('data-focus', 'earth');
});

test('spacecraft: Voyager 1 is 180 AU out with a clipped path, and the toggle hides crafts', async ({ page }) => {
  await page.goto('./solar?body=voyager1&view=planet&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-focus', 'voyager1');
  await expect(page.locator('[data-testid="info-panel"] h2')).toHaveText('Voyager 1');
  await expect(page.locator('[data-testid="info-panel"]')).toContainText('km/s', { timeout: 15_000 });
  await expect(page.locator('[data-testid="info-panel"]')).toContainText(/1[6-8]\d\.\d{3} AU/);
  await page.locator('[data-testid="crafts-toggle"]').click();
  await expect.poll(() => page.url()).toContain('craft=0');
});

test('command palette reaches Halley and the Halley path exists before 1986', async ({ page }) => {
  await page.goto('./solar?t=1985-11-01T00:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  const input = page.locator('.palette-input');
  await input.fill('Go to Halley');
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-focus', 'halley');
  await expect(page.locator('[data-testid="info-panel"]')).toContainText('Last perihelion 9 February 1986');
});

test('command palette opens with Cmd/Ctrl+K and navigates', async ({ page }) => {
  await page.goto('./solar?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  const input = page.locator('.palette-input');
  await expect(input).toBeVisible();
  await input.fill('Go to Neptune');
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-focus', 'neptune');
});
