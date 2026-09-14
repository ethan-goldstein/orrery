import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('advects particles through the OSCAR field', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./oceans?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-flow-date', '2014-09-26');
  await expect.poll(async () => Number(await canvas.getAttribute('data-particles'))).toBeGreaterThan(10_000);
  await expect(canvas).toHaveAttribute('data-playing', 'true');
  expect(errors).toEqual([]);
});

test('presets, pause and reveal update state and URL', async ({ page }) => {
  await page.goto('./oceans?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('button', { name: 'Gulf Stream' }).click();
  await expect(canvas).toHaveAttribute('data-preset', 'gulf');
  await page.locator('[data-testid="oceans-play"]').click();
  await expect(canvas).toHaveAttribute('data-playing', 'false');
  await expect.poll(() => page.url()).toContain('preset=gulf');
});
