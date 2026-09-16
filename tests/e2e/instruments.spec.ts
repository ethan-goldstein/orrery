import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('dragging the time scrubber moves simulation time and stops following now', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  const scrubber = page.getByRole('slider', { name: 'Simulation time' });
  await expect(scrubber).toBeVisible();
  const box = (await scrubber.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 55, cy, { steps: 6 });
  await page.mouse.up();
  // window is ±6 h when frozen; a quarter-width drag to the left is +3 h
  await expect(page.getByTestId('sim-time')).toContainText('2026-09-14 15:00');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('sim-time')).toContainText('2026-09-14 14:');
});

test('the rate stepper and the facts toggle work', async ({ page }) => {
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  const select = page.getByRole('combobox', { name: 'Simulation speed' });
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(select).toHaveValue('1');
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(select).toHaveValue('60');
  await page.getByRole('button', { name: 'Slower' }).click();
  await expect(select).toHaveValue('1');
  const drawer = page.getByTestId('mars-panel');
  await expect(drawer).toBeVisible();
  await page.getByRole('button', { name: 'Hide facts' }).click();
  await expect(drawer).toBeHidden();
  await page.keyboard.press('i');
  await expect(drawer).toBeVisible();
});
