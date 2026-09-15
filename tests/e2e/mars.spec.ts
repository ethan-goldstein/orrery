import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('landing site deep link flies to Perseverance and labels sites', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./mars?site=perseverance&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-site', 'perseverance');
  await expect(page.locator('[data-testid="mars-title"]')).toHaveText('Perseverance');
  await expect(page.locator('.body-label:not([hidden])', { hasText: 'Perseverance' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="mars-panel"]')).toContainText('million km');
  expect(errors).toEqual([]);
});

test('presets, dust slider and URL', async ({ page }) => {
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-preset', 'global');
  await expect(canvas).toHaveAttribute('data-lighting', 'real');
  await page.getByRole('button', { name: 'Olympus Mons' }).click();
  await expect(canvas).toHaveAttribute('data-preset', 'olympus');
  await expect(canvas).toHaveAttribute('data-lighting', 'illustrative');
  await page.locator('[data-testid="dust-slider"]').evaluate((el) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.9');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(canvas).toHaveAttribute('data-dust', '0.90');
  await expect.poll(() => page.url()).toContain('dust=0.90');
});

test('Solar System to Mars carries the camera', async ({ page }) => {
  await page.goto('./solar?body=mars&view=planet&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('navigation', { name: 'Worlds' }).getByRole('link', { name: 'Mars', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-experience', 'mars');
  await expect(canvas).toHaveAttribute('data-handoff', 'accepted', { timeout: 30_000 });
});
