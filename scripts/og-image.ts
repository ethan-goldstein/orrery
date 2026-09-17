/**
 * Render the Open Graph cards from the site itself: a real frame from the
 * built app for the site and for each world, captioned in the site's own
 * type. Needs `dist/` (run `BASE_PATH=/orrery/ npm run build` first) and
 * Playwright's Chromium.
 *
 *   npx tsx scripts/og-image.ts            # every card
 *   npx tsx scripts/og-image.ts moon mars  # just these
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PORT = 4700;
const BASE = '/orrery/';

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

interface Card {
  /** file suffix: og.jpg for the site, og-<id>.jpg for a world */
  id: string | null;
  route: string;
  kicker: string;
  headline: string;
  dek: string;
  /** '+' presses after the arrival flight settles */
  zoomIn: number;
  /** where the render sits in the 1500 px wide frame: how far to shift it left */
  shift: number;
}

const CARDS: Card[] = [
  { id: null, route: 'solar?body=saturn&view=planet&t=2026-09-14T12:00:00Z&rate=0&labels=0&q=ultra', kicker: 'An atlas of worlds', headline: 'Everything,<br>in motion.', dek: 'The Solar System at any date, Earth across 4.54 billion years, the Moon and Mars up close, satellites, earthquakes, oceans and the human story.', zoomIn: 2, shift: 150 },
  { id: 'solar', route: 'solar?body=jupiter&view=moons&t=2026-09-14T12:00:00Z&rate=0&labels=0&q=ultra', kicker: 'Solar System', headline: 'Eight worlds.<br>One star.', dek: 'Real positions for any date, 22 moons, spacecraft on their true paths, and a morph between illustrated and true scale.', zoomIn: 1, shift: 150 },
  { id: 'earth', route: 'earth?ma=0&t=2026-09-14T12:00:00Z&rate=0&q=ultra', kicker: 'Earth', headline: '4.54 billion years,<br>ten eras.', dek: 'Palaeogeographic reconstructions blended in-shader, honest labels, and the real sun for today.', zoomIn: 0, shift: 200 },
  { id: 'moon', route: 'moon?preset=near&t=2026-09-14T12:00:00Z&rate=0&labels=0&q=ultra', kicker: 'The Moon', headline: 'Another world,<br>within reach.', dek: 'LROC colour and LOLA relief, real phase and libration, and every landing site from Luna 2 on.', zoomIn: 0, shift: 200 },
  { id: 'mars', route: 'mars?preset=global&t=2026-09-14T12:00:00Z&rate=0&labels=0&q=ultra', kicker: 'Mars', headline: 'The red<br>frontier.', dek: 'Oriented for the real date, with Phobos and Deimos, eleven landing sites, Olympus Mons and Valles Marineris.', zoomIn: 0, shift: 200 },
  { id: 'orbit', route: 'orbit?group=leo&t=2026-09-14T12:00:00Z&rate=0&q=ultra', kicker: 'Orbit', headline: 'A planet<br>in a shell of machines.', dek: 'Nearly twenty thousand tracked objects propagated live with SGP4, grouped by orbit, searchable, followable.', zoomIn: 0, shift: 200 },
  { id: 'quakes', route: 'quakes?preset=all&t=2026-09-14T12:00:00Z&rate=0&q=ultra', kicker: 'Earthquakes', headline: 'Where the<br>ground moves.', dek: 'Every magnitude 6 and up since 2000 from USGS, sized by magnitude, coloured by depth, replayable through time.', zoomIn: 0, shift: 200 },
  { id: 'oceans', route: 'oceans?preset=planet&t=2026-09-14T12:00:00Z&rate=0&q=ultra', kicker: 'Oceans', headline: 'One ocean,<br>always moving.', dek: 'OSCAR surface currents as a hundred thousand GPU-advected particles, with the Gulf Stream, the Pacific and the Southern Ocean.', zoomIn: 0, shift: 200 },
  { id: 'civilization', route: 'civilization?ch=12&t=2026-09-14T12:00:00Z&rate=0&q=ultra', kicker: 'Civilization', headline: 'The human story,<br>on the globe.', dek: 'Eighteen chapters from Jebel Irhoud to today, with night lights that only appear once electricity does.', zoomIn: 0, shift: 200 },
];

const only = process.argv.slice(2);
const cards = only.length ? CARDS.filter((c) => only.includes(c.id ?? 'site')) : CARDS;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  for (const c of cards) {
    const out = `public/icons/${c.id ? `og-${c.id}` : 'og'}.jpg`;
    // render wider than the card so the subject can sit right of the plate
    const page = await browser.newPage({ viewport: { width: 1500, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(`${origin}${BASE}${c.route}`);
    await page.locator('canvas.orrery-canvas').waitFor();
    await page.waitForFunction(() => document.querySelector('canvas.orrery-canvas')?.getAttribute('data-experience-state') === 'ready', undefined, { timeout: 60_000 });
    await page.keyboard.press('h'); // clean view: just the render
    await page.waitForTimeout(5000); // textures and the arrival flight
    for (let i = 0; i < c.zoomIn; i++) await page.keyboard.press('+');
    if (c.zoomIn) await page.waitForTimeout(3000);
    const frame = await page.locator('canvas.orrery-canvas').screenshot({ type: 'png' });
    await page.close();

    const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await card.setContent(`<!doctype html><html><head>
    <link rel="stylesheet" href="${origin}${BASE}assets/${css}">
    <style>
      html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#070a12}
      .bg{position:absolute;top:0;left:${c.shift}px;width:1500px;height:630px}
      .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,10,18,.82) 0%,rgba(7,10,18,.55) 42%,rgba(7,10,18,0) 70%)}
      .plate{position:absolute;left:64px;top:150px;width:520px;color:#efe6d3}
      .kicker{font:500 15px "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:#b7ae9c;padding-top:14px;border-top:1px solid rgba(239,230,211,.28);display:inline-block;min-width:260px}
      h1{font-family:"Fraunces Variable",Fraunces,Georgia,serif;font-variation-settings:"opsz" 144,"SOFT" 30;font-weight:400;font-size:64px;line-height:1.02;letter-spacing:-.01em;margin:18px 0 0}
      .dek{font:400 19px "IBM Plex Sans",system-ui,sans-serif;color:#b7ae9c;margin-top:20px;line-height:1.4}
      .foot{position:absolute;left:64px;bottom:52px;display:flex;align-items:center;gap:14px;color:#c9a961;font:500 15px "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}
      .foot svg{width:28px;height:28px}
      .rule{position:absolute;left:64px;right:64px;bottom:96px;border-top:1px solid rgba(239,230,211,.18)}
    </style></head><body>
    <img class="bg" src="data:image/png;base64,${frame.toString('base64')}">
    <div class="shade"></div>
    <div class="plate">
      <span class="kicker">${c.kicker}</span>
      <h1>${c.headline}</h1>
      <p class="dek">${c.dek}</p>
    </div>
    <div class="rule"></div>
    <div class="foot">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="6.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-20 12 12)"/><circle cx="19.2" cy="8.4" r="1.4" fill="currentColor" stroke="none"/></svg>
      <span>orrery · ethan-goldstein.github.io/orrery${c.id ? `/${c.id}` : ''}</span>
    </div>
  </body></html>`);
    await card.evaluate(() => document.fonts.ready);
    await card.waitForTimeout(300);
    const png = await card.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await card.close();
    const jpg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    writeFileSync(out, jpg);
    console.log(`wrote ${out} (${jpg.length} bytes)`);
  }
} finally {
  await browser.close();
  stop();
}
