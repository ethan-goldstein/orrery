import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('opens on chapter one and steps with keys and buttons', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./civilization?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-chapter', '1');
  await expect(page.locator('[data-testid="chapter-title"]')).toHaveText('Africa');
  await page.locator('[data-testid="next-chapter"]').click();
  await expect(canvas).toHaveAttribute('data-chapter', '2');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('ArrowRight');
  await expect(canvas).toHaveAttribute('data-chapter', '3');
  await expect.poll(() => page.url()).toContain('ch=3');
  expect(errors).toEqual([]);
});

test('deep link to Manhattan turns the night lights on', async ({ page }) => {
  await page.goto('./civilization?ch=17&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-chapter', '17');
  await expect(canvas).toHaveAttribute('data-night', 'true');
  await expect(page.locator('[data-testid="chapter-title"]')).toContainText('Manhattan');
  await page.locator('button[data-chapter="5"]').click();
  await expect(canvas).toHaveAttribute('data-chapter', '5');
  await expect(canvas).toHaveAttribute('data-night', 'false');
});
