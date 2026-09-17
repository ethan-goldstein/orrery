import { expect, test } from '@playwright/test';
import { statSync } from 'node:fs';

test('without WebGL 2 the site explains itself instead of crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgl') return null;
      return (get as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => unknown).call(this, type, ...rest) as ReturnType<typeof get>;
    } as typeof get;
  });
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  const fallback = page.getByTestId('webgl-fallback');
  await expect(fallback).toBeVisible({ timeout: 20_000 });
  await expect(fallback).toContainText('cannot draw the sky');
  await expect(page.locator('canvas.orrery-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a lost WebGL context pauses with a message and recovers with a picture', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'WEBGL_lose_context is only reliable in Chromium here');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const c = document.querySelector('canvas.orrery-canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const ext = gl.getExtension('WEBGL_lose_context')!;
    (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
    ext.loseContext();
  });
  await expect(canvas).toHaveAttribute('data-renderer', 'lost');
  await expect(page.getByRole('status').filter({ hasText: 'Graphics paused' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'ready', { timeout: 20_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Graphics paused' })).toHaveCount(0);
  // the picture is back: a capture of the frame is far bigger than a black one would be
  await page.waitForTimeout(2500);
  await page.getByTestId('share-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-image').click()]);
  const path = await download.path();
  expect(statSync(path!).size).toBeGreaterThan(20_000);
  expect(errors).toEqual([]);
});
