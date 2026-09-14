import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('shows every M6+ quake since 2000', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./quakes?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 20_000 }).toBeGreaterThan(3500);
  await expect(page.locator('[data-testid="quakes-panel"]')).toContainText('since 2000');
  expect(errors).toEqual([]);
});

test('presets filter and the scrub reveals in time order', async ({ page }) => {
  await page.goto('./quakes?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 20_000 }).toBeGreaterThan(3500);
  const all = Number(await canvas.getAttribute('data-visible'));
  await page.getByRole('button', { name: 'Deep Earth' }).click();
  await expect(canvas).toHaveAttribute('data-preset', 'deep');
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible'))).toBeLessThan(all / 3);
  await page.getByRole('button', { name: 'Japan 2011' }).click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible'))).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'All earthquakes' }).click();
  await page.locator('[data-testid="quakes-scrub"]').evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, Date.UTC(2005, 0, 1) / 1000);
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible'))).toBeLessThan(all / 3);
  await expect.poll(() => page.url()).toContain('year=2005');
});

test('play sweeps the timeline', async ({ page }) => {
  await page.goto('./quakes?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 20_000 }).toBeGreaterThan(3500);
  await page.locator('[data-testid="quakes-play"]').click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible'))).toBeLessThan(500);
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 20_000 }).toBeGreaterThan(500);
});
