import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  const canvas = page.locator('canvas.orrery-canvas');
  await expect(canvas).toHaveAttribute('data-experience-state', 'ready', { timeout: 60_000 });
  return canvas;
};

test('Solar System to Earth carries the camera over without a veil', async ({ page }) => {
  await page.goto('./solar?body=earth&view=planet&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('navigation', { name: 'Worlds' }).getByRole('link', { name: 'Earth', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-experience', 'earth');
  await expect(canvas).toHaveAttribute('data-handoff', 'accepted', { timeout: 30_000 });
  await expect(page.locator('.journey-veil')).toHaveAttribute('data-journey', /seamless|none/);
  await ready(page);
});

test('Earth to the Moon is an arrival flight', async ({ page }) => {
  await page.goto('./earth?ma=0&t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('navigation', { name: 'Worlds' }).getByRole('link', { name: 'Moon' }).click();
  await expect(canvas).toHaveAttribute('data-experience', 'moon');
  await expect(canvas).toHaveAttribute('data-handoff', 'accepted', { timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-arrival', 'done', { timeout: 15_000 });
});

test('Moon back to the Solar System lands on the Moon in planet view', async ({ page }) => {
  await page.goto('./moon?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('navigation', { name: 'Worlds' }).getByRole('link', { name: 'Solar System' }).click();
  await expect(canvas).toHaveAttribute('data-experience', 'solar');
  await expect(canvas).toHaveAttribute('data-focus', 'moon', { timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-handoff', 'accepted');
});

test('worlds without a shared camera still fade through the veil', async ({ page }) => {
  await page.goto('./orbit?t=2026-09-14T12:00:00Z&rate=0');
  const canvas = await ready(page);
  await page.getByRole('navigation', { name: 'Worlds' }).getByRole('link', { name: 'Earthquakes' }).click();
  await expect(canvas).toHaveAttribute('data-experience', 'quakes');
  await expect(canvas).toHaveAttribute('data-handoff', 'none', { timeout: 30_000 });
});
