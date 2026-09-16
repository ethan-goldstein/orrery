import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('the controls hint shows once, leaves on the first wheel, and stays gone', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  const hint = page.getByTestId('controls-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Drag to orbit');
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 100);
  await expect(hint).toBeHidden();
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await expect(page.getByTestId('controls-hint')).toHaveCount(0);
});

test('the hint is not shown on the home page and has a close button elsewhere', async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await expect(page.getByTestId('controls-hint')).toHaveCount(0);
  await page.goto('./earth?ma=0&t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.getByRole('button', { name: 'Dismiss hint' }).click();
  await expect(page.getByTestId('controls-hint')).toHaveCount(0);
});
