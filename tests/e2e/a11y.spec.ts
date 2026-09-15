import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/solar', '/earth', '/moon', '/mars', '/orbit', '/quakes', '/oceans', '/civilization'];

for (const route of routes) {
  test(`axe: ${route} has no serious or critical violations`, async ({ page }) => {
    await page.goto(`.${route}?t=2026-09-14T12:00:00Z&rate=0`);
    await expect(page.locator('canvas.orrery-canvas')).toHaveAttribute('data-experience-state', 'ready', { timeout: 60_000 });
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  });
}

test('mobile: bottom sheet opens and the page has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./solar?t=2026-09-14T12:00:00Z&rate=0');
  await expect(page.locator('canvas.orrery-canvas')).toHaveAttribute('data-experience-state', 'ready', { timeout: 60_000 });
  const sheet = page.locator('[data-testid="mobile-sheet"]');
  await expect(sheet).toHaveAttribute('data-open', 'false');
  await sheet.getByRole('button', { name: /View controls/ }).click();
  await expect(sheet).toHaveAttribute('data-open', 'true');
  await expect(page.getByRole('button', { name: 'Grand tour' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
