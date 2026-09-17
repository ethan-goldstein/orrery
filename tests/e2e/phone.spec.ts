import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test.use({ viewport: { width: 390, height: 844 } });

test('the facts drawer rides inside the phone sheet', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  const sheet = page.getByTestId('mobile-sheet');
  await expect(sheet).toHaveAttribute('data-open', 'false');
  // closed: the drawer is in the sheet body, which is inert and off screen
  const panel = page.getByTestId('moon-panel');
  await expect(panel).toBeAttached();
  await expect(panel).not.toBeInViewport();
  await page.getByRole('button', { name: /View controls/ }).click();
  await expect(sheet).toHaveAttribute('data-open', 'true');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Right now');
  // the sheet holds the whole page: copy, controls, then the facts
  const sheetBox = (await sheet.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.width).toBeLessThanOrEqual(sheetBox.width);
  expect(panelBox.x).toBeGreaterThanOrEqual(sheetBox.x);
});

test('the Earth age readout and the Solar info panel are reachable on a phone', async ({ page }) => {
  await page.goto('./earth?ma=650&t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.getByRole('button', { name: /View controls/ }).click();
  await expect(page.getByTestId('age-readout')).toBeVisible();
  await page.goto('./solar?body=mars&view=planet&t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await page.getByRole('button', { name: /View controls/ }).click();
  await expect(page.getByTestId('info-panel').locator('h2')).toHaveText('Mars');
});

test('a closed sheet lets the wheel through to the globe', async ({ page }) => {
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  const stage = page.locator('[role="application"]');
  await expect(stage).toHaveAttribute('data-camera-distance', /./);
  await page.waitForTimeout(1500);
  const before = Number(await stage.getAttribute('data-camera-distance'));
  // over the globe, above the sheet's handle
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, 200);
  await page.mouse.wheel(0, 200);
  await expect.poll(async () => Number(await stage.getAttribute('data-camera-distance'))).toBeGreaterThan(before * 1.05);
});
