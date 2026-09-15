import { expect, test, type Page } from '@playwright/test';

const routes = ['/', '/solar', '/earth', '/moon', '/mars', '/orbit', '/quakes', '/oceans', '/civilization'];

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

for (const route of routes) {
  test(`renders ${route}`, async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto(`.${route}`);
    const canvas = page.locator('canvas.orrery-canvas');
    await expect(canvas).toHaveAttribute('data-renderer', 'ready', { timeout: 30_000 });
    await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 30_000 });
    expect(Number(await canvas.getAttribute('data-dpr'))).toBeLessThanOrEqual(2);
    await expect(page.locator('[data-testid="timebar"]')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('deep links carry time state', async ({ page }) => {
  await page.goto('./solar?t=2026-09-14T12:00:00Z&rate=0');
  await expect(page.locator('[data-testid="sim-time"]')).toHaveText('2026-09-14 12:00 UTC');
});

test('Now button tracks wall clock', async ({ page }) => {
  await page.goto('./solar?t=now');
  const text = await page.locator('[data-testid="sim-time"]').textContent();
  const shown = Date.parse(text!.replace(' UTC', 'Z').replace(' ', 'T'));
  expect(Math.abs(shown - Date.now())).toBeLessThan(120_000);
});
