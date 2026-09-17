import { expect, test, type Page } from '@playwright/test';
import { statSync } from 'node:fs';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('copy link puts the current address on the clipboard', async ({ page }) => {
  await page.goto('./moon?preset=far-side&t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.getByTestId('share-button').click();
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toHaveText('Link copied');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('/moon');
  expect(decodeURIComponent(text)).toContain('t=2026-09-14T12:00:00');
});

test('save image downloads a captioned PNG of the frame', async ({ page }) => {
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.waitForTimeout(1500);
  await page.getByTestId('share-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-image').click()]);
  expect(download.suggestedFilename()).toMatch(/^orrery-mars-2026-09-14-1200\.png$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(statSync(path!).size).toBeGreaterThan(20_000);
  await expect(page.getByTestId('share-status')).toContainText('Saved orrery-mars');
});

test('portrait viewports frame the whole globe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.waitForTimeout(1200);
  // camera distance should be widened by roughly the inverse aspect (844/390 ≈ 2.16) over the landscape preset
  const stage = page.locator('[role="application"]');
  const d = Number(await stage.getAttribute('data-camera-distance'));
  const min = Number(await stage.getAttribute('data-camera-min'));
  // near preset is about 3.1 radii in landscape; expect roughly 6.7 radii here (min ≈ 1.08 radii)
  expect(d / (min / 1.08)).toBeGreaterThan(5.5);
  expect(d / (min / 1.08)).toBeLessThan(8);
});

test('the command palette can copy the link and save an image', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.locator('.palette-input');
  await expect(input).toBeVisible();
  await input.fill('copy a link');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/moon');
  await page.keyboard.press('ControlOrMeta+k');
  await input.fill('save an image');
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(download.suggestedFilename()).toMatch(/^orrery-moon-.*\.png$/);
});
