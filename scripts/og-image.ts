/**
 * Render the Open Graph card from the site itself: a real Saturn frame from
 * the built app, captioned in the site's own type. Needs `dist/` (run
 * `BASE_PATH=/orrery/ npm run build` first) and Playwright's Chromium.
 *
 *   npx tsx scripts/og-image.ts
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4700;
const BASE = '/orrery/';
const OUT = 'public/icons/og.png';

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing: build first with BASE_PATH=/orrery/ npm run build');
  process.exit(1);
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { env: { ...process.env, BASE_PATH: BASE }, stdio: 'ignore' });
const stop = () => {
  if (!preview.killed) preview.kill();
};
process.on('exit', stop);

async function waitForServer(url: string, ms = 20_000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview did not come up at ${url}`);
}

const origin = `http://localhost:${PORT}`;
await waitForServer(`${origin}${BASE}`);

const css = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.css'));
if (!css) throw new Error('built stylesheet not found in dist/assets');

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  // render wider than the card so Saturn can sit right of the plate, then move in a little
  const page = await browser.newPage({ viewport: { width: 1500, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`${origin}${BASE}solar?body=saturn&view=planet&t=2026-09-14T12:00:00Z&rate=0&labels=0&q=ultra`);
  await page.locator('canvas.orrery-canvas').waitFor();
  await page.waitForFunction(() => document.querySelector('canvas.orrery-canvas')?.getAttribute('data-experience-state') === 'ready', undefined, { timeout: 60_000 });
  await page.keyboard.press('h'); // clean view: just the render
  await page.waitForTimeout(4000); // textures and the arrival flight
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.waitForTimeout(3000); // the zoom settles
  const frame = await page.locator('canvas.orrery-canvas').screenshot({ type: 'png' });

  const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await card.setContent(`<!doctype html><html><head>
    <link rel="stylesheet" href="${origin}${BASE}assets/${css}">
    <style>
      html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#070a12}
      .bg{position:absolute;top:0;left:150px;width:1500px;height:630px}
      .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,10,18,.82) 0%,rgba(7,10,18,.55) 42%,rgba(7,10,18,0) 70%)}
      .plate{position:absolute;left:64px;top:150px;width:520px;color:#efe6d3}
      .kicker{font:500 15px "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:#b7ae9c;padding-top:14px;border-top:1px solid rgba(239,230,211,.28);display:inline-block;min-width:260px}
      h1{font-family:"Fraunces Variable",Fraunces,Georgia,serif;font-variation-settings:"opsz" 144,"SOFT" 30;font-weight:400;font-size:74px;line-height:1.0;letter-spacing:-.01em;margin:18px 0 0}
      .dek{font:400 20px "IBM Plex Sans",system-ui,sans-serif;color:#b7ae9c;margin-top:22px;line-height:1.4}
      .foot{position:absolute;left:64px;bottom:52px;display:flex;align-items:center;gap:14px;color:#c9a961;font:500 15px "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}
      .foot svg{width:28px;height:28px}
      .rule{position:absolute;left:64px;right:64px;bottom:96px;border-top:1px solid rgba(239,230,211,.18)}
    </style></head><body>
    <img class="bg" src="data:image/png;base64,${frame.toString('base64')}">
    <div class="shade"></div>
    <div class="plate">
      <span class="kicker">An atlas of worlds</span>
      <h1>Everything,<br>in motion.</h1>
      <p class="dek">The Solar System at any date, Earth across 4.54 billion years, the Moon and Mars up close, satellites, earthquakes, oceans and the human story.</p>
    </div>
    <div class="rule"></div>
    <div class="foot">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="6.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-20 12 12)"/><circle cx="19.2" cy="8.4" r="1.4" fill="currentColor" stroke="none"/></svg>
      <span>orrery · ethan-goldstein.github.io/orrery</span>
    </div>
  </body></html>`);
  await card.evaluate(() => document.fonts.ready);
  await card.waitForTimeout(300);
  const png = await card.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  writeFileSync(OUT, png);
  console.log(`wrote ${OUT} (${png.length} bytes)`);
} finally {
  await browser.close();
  stop();
}
