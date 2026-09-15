# Orrery

An atlas of worlds, rendered in the browser from real data.

Live: https://ethan-goldstein.github.io/orrery/

| World | What it shows |
| --- | --- |
| [Solar System](https://ethan-goldstein.github.io/orrery/solar/) | Sun, eight planets, Pluto and 22 moons at any date, computed live with astronomy-engine and validated against JPL Horizons. Real axial tilt and spin, illustrated-to-true scale morph, Saturn's rings with mutual shadows, eclipses on moons, compare-size line-up, grand tour. |
| [Earth](https://ethan-goldstein.github.io/orrery/earth/) | 4.54 billion years in ten eras. 109 PALEOMAP elevation frames blended in-shader, honesty labels, compare with today, story playback, three lighting moods, scroll to travel. |
| [Moon](https://ethan-goldstein.github.io/orrery/moon/) | LROC colour and LOLA relief, real libration and phase for the date, 17 landing sites from Luna 2 to Blue Ghost, guided tour, Earth in the sky with its true phase. |
| [Orbit](https://ethan-goldstein.github.io/orrery/orbit/) | 19,799 tracked objects propagated with SGP4 in a worker, LEO / MEO / GEO groups, debris toggle, search, follow the ISS, the space age year by year. |
| [Earthquakes](https://ethan-goldstein.github.io/orrery/quakes/) | Every M6+ earthquake since 2000 from USGS, sized by magnitude, coloured by depth, replayable through time. |
| [Oceans](https://ethan-goldstein.github.io/orrery/oceans/) | OSCAR surface currents as 100k GPU-advected particles, with Gulf Stream, Pacific and Southern Ocean presets. |
| [Civilization](https://ethan-goldstein.github.io/orrery/civilization/) | Eighteen chapters of the human story from Jebel Irhoud to today, with night lights that only appear once electricity does. |

Everywhere: a command palette (Cmd+K), keyboard shortcuts (`?`), deep links for every state, a Sources dialog generated from the asset manifest, quality tiers, a mobile bottom sheet, and an installable PWA.

## Run

```bash
npm ci
npm run data:hyg                     # star catalog (once)
npx tsx scripts/fetch-horizons.ts    # moon seeds + test fixtures from JPL Horizons (once)
npx tsx scripts/build-textures.ts    # planet maps -> 1k/2k/4k webp/avif (once, ~2 min)
npx tsx scripts/fetch-celestrak.ts   # satellite snapshot
npx tsx scripts/fetch-usgs.ts        # earthquakes
npx tsx scripts/fetch-natural-earth.ts
python3 -m venv scripts/.venv && scripts/.venv/bin/pip install netCDF4 numpy pillow
scripts/.venv/bin/python scripts/paleodem-to-frames.py   # needs the PaleoDEM zip in scripts/.cache/paleo (see script)
scripts/.venv/bin/python scripts/oscar-to-flow.py
scripts/.venv/bin/python scripts/moon-normal.py
npx tsx scripts/build-ktx2.ts        # GPU-compressed KTX2 copies of every texture (Basis Universal wasm encoder in scripts/.cache/basis)
npm run credits                      # regenerate CREDITS.md and the Sources dialog
npm run dev
```

## Verify

```bash
npm test              # vitest: astronomy, scale math, url state
npm run build         # tsc + vite
npx playwright install chromium
npm run test:e2e      # smoke test every route against the built site
```

Serve under the GitHub Pages subpath locally with `BASE_PATH=/orrery/ npm run build && BASE_PATH=/orrery/ npm run preview`.

## Layout

- `src/engine` framework-free three.js: renderer, composer, camera rig, starfield, floating origin
- `src/astro` pure astronomy: frames, time, ephemeris wrappers, rotation, scale morph
- `src/experiences/<page>` one Experience subclass per page
- `src/ui` React chrome, `src/store` zustand state shared by React and the engine
- `scripts/` reproducible data pipelines; outputs committed under `public/data`. Textures ship as WebP/AVIF tiers plus KTX2 (ETC1S for colour, UASTC for normal maps); the loader picks KTX2 when the GPU can transcode it and falls back to WebP otherwise.
- `tests/unit` vitest, `tests/e2e` Playwright

See CREDITS.md for data and imagery licenses.
