import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('landing site deep link flies to Apollo 11 and labels sites', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./moon?site=apollo11&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-site', 'apollo11');
  await expect(page.locator('h1')).toHaveText('Apollo 11');
  await expect(page.locator('.body-label:not([hidden])', { hasText: 'Apollo 11' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="moon-lighting"]')).toHaveText('Illustrative lighting');
  expect(errors).toEqual([]);
});

test('near side default uses the real illumination and shows distance', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-preset', 'near');
  await expect(canvas).toHaveAttribute('data-lighting', 'real');
  await expect(page.locator('[data-testid="moon-panel"]')).toContainText('km');
  await expect(page.locator('[data-testid="moon-panel"]')).toContainText('% lit');
});

test('presets and the site picker update state and URL', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('button', { name: 'Far side' }).click();
  await expect(canvas).toHaveAttribute('data-preset', 'far');
  await page.locator('[data-testid="site-select"]').selectOption('change4');
  await expect(canvas).toHaveAttribute('data-site', 'change4');
  await expect.poll(() => page.url()).toContain('site=change4');
  await expect(page.locator('h1')).toHaveText("Chang'e 4");
});
