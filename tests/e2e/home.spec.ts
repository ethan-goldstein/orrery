import { expect, test } from '@playwright/test';

test('the home page carries a live almanac with links into the worlds', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('canvas.orrery-canvas')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  const cards = page.locator('[data-testid="almanac"] a');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });
  await expect(page.locator('[data-almanac="moon"]')).toContainText(/% lit/);
  await expect(page.locator('[data-almanac="moon"]')).toHaveAttribute('href', /\/moon\?t=/);
  await expect(page.locator('[data-almanac="orbit"]')).toContainText(/objects/);
  await page.locator('[data-almanac="moon"]').click();
  await expect(page).toHaveURL(/\/moon/);
  await expect(page.locator('canvas.orrery-canvas')).toHaveAttribute('data-experience', 'moon', { timeout: 30_000 });
});
