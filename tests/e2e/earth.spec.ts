import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  return canvas;
};

test('today is photographic with the real sun', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./earth?ma=0&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-era', 'present');
  await expect(canvas).toHaveAttribute('data-lighting', 'real');
  await expect(page.locator('[data-testid="age-readout"]')).toHaveText('Now');
  await expect(page.getByText('Photographic Earth')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Pangaea loads PaleoDEM frames and is labelled a reconstruction', async ({ page }) => {
  await page.goto('./earth?ma=300&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await expect(canvas).toHaveAttribute('data-era', 'pangaea');
  await expect.poll(async () => Number(await canvas.getAttribute('data-frames')), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(page.getByText('Paleogeographic reconstruction')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-lighting', 'illustrative');
});

test('keyboard and timeline travel through eras', async ({ page }) => {
  await page.goto('./earth?ma=0&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('ArrowLeft');
  await expect(canvas).toHaveAttribute('data-era', 'cretaceous');
  await page.keyboard.press('Home');
  await expect(canvas).toHaveAttribute('data-era', 'formation');
  await expect(page.getByText('Artistic interpretation')).toBeVisible();
  await page.locator('[data-testid="timeline"] button[data-era="snowball"]').click();
  await expect(canvas).toHaveAttribute('data-era', 'snowball');
  await expect.poll(() => page.url()).toContain('ma=650');
});

test('plain scroll zooms; Shift+scroll travels in time', async ({ page }) => {
  await page.goto('./earth?ma=0&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  const stage = page.locator('[role="application"]');
  await expect(stage).toHaveAttribute('data-camera-distance', /./);
  const before = Number(await stage.getAttribute('data-camera-distance'));
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 240);
  await page.mouse.wheel(0, 240);
  await expect.poll(async () => Number(await stage.getAttribute('data-camera-distance'))).toBeGreaterThan(before * 1.05);
  expect(Number(await canvas.getAttribute('data-ma'))).toBe(0);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 240);
  await page.mouse.wheel(0, 240);
  await page.keyboard.up('Shift');
  await expect.poll(async () => Number(await canvas.getAttribute('data-ma'))).toBeGreaterThan(100);
});

test('play story advances and compare mode toggles', async ({ page }) => {
  await page.goto('./earth?ma=0&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.locator('[data-testid="play-story"]').click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-ma'))).toBeGreaterThan(4000);
  await expect.poll(async () => Number(await canvas.getAttribute('data-ma')), { timeout: 15_000 }).toBeLessThan(4400);
  await page.keyboard.press('c');
  await expect(page.getByText('Present-day comparison')).toBeVisible();
});
