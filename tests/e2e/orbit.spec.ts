import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 60_000 });
  return canvas;
};

test('plots thousands of near-Earth objects', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./orbit?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-group', 'leo');
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 60_000 }).toBeGreaterThan(1000);
  await expect(page.locator('[data-testid="orbit-panel"]')).toContainText('tracked');
  await expect(page.locator('[data-testid="orbit-snapshot"]')).toHaveText(/\d{4}-\d{2}-\d{2}/);
  expect(errors).toEqual([]);
});

test('finds and follows the ISS from a deep link', async ({ page }) => {
  await page.goto('./orbit?sat=25544&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-selected', '25544', { timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-follow', 'true');
  await expect(page.locator('h1')).toContainText('ISS', { timeout: 30_000 });
  await expect(page.locator('h1')).toBeVisible();
});

test('search selects a satellite and the space-age scrub filters', async ({ page }) => {
  await page.goto('./orbit?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 60_000 }).toBeGreaterThan(1000);
  const before = Number(await canvas.getAttribute('data-visible'));
  await page.locator('[data-testid="sat-search"]').fill('HST');
  await page.getByRole('listbox').getByRole('button').first().click();
  await expect(canvas).toHaveAttribute('data-selected', /\d+/);
  await page.locator('[data-testid="year-scrub"]').fill('1995');
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible')), { timeout: 20_000 }).toBeLessThan(before / 4);
  await expect.poll(() => page.url()).toContain('year=1995');
});
