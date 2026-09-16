import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
  const stage = page.locator('[role="application"]');
  await expect(stage).toHaveAttribute('data-camera-distance', /./);
  return stage;
};

const num = async (page: Page, attr: string) => Number(await page.locator('[role="application"]').getAttribute(attr));

/** Wait until the camera distance has been stable for three samples (CI renders at a few fps, so give it room). */
const settled = async (page: Page) => {
  await page.waitForTimeout(400);
  let last = await num(page, 'data-camera-distance');
  let stable = 0;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250);
    const d = await num(page, 'data-camera-distance');
    stable = Math.abs(d - last) < Math.abs(d) * 2e-4 ? stable + 1 : 0;
    last = d;
    if (stable >= 3) return d;
  }
  return last;
};

test('wheel zoom is monotone, never overshoots, and respects the limits', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await settled(page);
  const max = await num(page, 'data-camera-max');
  const min = await num(page, 'data-camera-min');
  await page.mouse.move(640, 360);
  // zoom out hard: 12 notches
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 100);
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    samples.push(await num(page, 'data-camera-distance'));
    await page.waitForTimeout(60);
  }
  for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]! * 0.999);
  for (const d of samples) expect(d).toBeLessThanOrEqual(max * 1.09);
  expect(await settled(page)).toBeLessThanOrEqual(max * 1.001);
  // zoom in hard
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -100);
  const inward: number[] = [];
  for (let i = 0; i < 20; i++) {
    inward.push(await num(page, 'data-camera-distance'));
    await page.waitForTimeout(60);
  }
  for (let i = 1; i < inward.length; i++) expect(inward[i]!).toBeLessThanOrEqual(inward[i - 1]! * 1.001);
  const rest = await settled(page);
  expect(rest).toBeGreaterThanOrEqual(min * 0.999);
  expect(rest).toBeLessThan(max * 0.5);
});

test('zoom keeps the point under the cursor', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  await settled(page);
  await page.mouse.move(500, 300);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
  await settled(page);
  const px = (await page.locator('[role="application"]').getAttribute('data-anchor-px')) ?? '';
  const [x, y] = px.split(',').map(Number);
  expect(Math.hypot(x! - 500, y! - 300)).toBeLessThan(12);
});

for (const route of ['solar?body=earth&view=planet', 'earth', 'moon', 'mars', 'orbit', 'quakes', 'oceans', 'civilization']) {
  test(`zoom buttons and reset work on /${route}`, async ({ page }) => {
    await page.goto(`./${route}${route.includes('?') ? '&' : '?'}t=2026-09-14T12:00:00Z&rate=0`);
    await ready(page);
    const home = await settled(page);
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    await expect(zoomIn).toBeEnabled();
    await zoomIn.click();
    await zoomIn.click();
    const closer = await settled(page);
    expect(closer).toBeLessThan(home * 0.9);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await page.waitForTimeout(3200);
    const back = await settled(page);
    expect(Math.abs(back - home) / home).toBeLessThan(0.02);
  });
}

test('the home page has a fixed camera', async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
});

test('keyboard zoom and double-click', async ({ page }) => {
  await page.goto('./mars?t=2026-09-14T12:00:00Z&rate=0');
  await ready(page);
  const home = await settled(page);
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  const farther = await settled(page);
  expect(farther).toBeGreaterThan(home * 1.1);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  const nearer = await settled(page);
  expect(nearer).toBeLessThan(farther * 0.9);
  await page.mouse.dblclick(640, 360);
  await page.waitForTimeout(2800);
  const dbl = await settled(page);
  expect(dbl).toBeLessThan(nearer * 0.8);
});
