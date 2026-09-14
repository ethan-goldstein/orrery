# Orrery

An atlas of worlds. Earth, the Moon, eight planets and their moons, tracked satellites,
earthquakes, ocean currents and the human story, rendered in the browser from real data.

Live: https://ethan-goldstein.github.io/orrery/

## Run

```bash
npm ci
npm run data:hyg      # star catalog (once)
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
- `scripts/` reproducible data pipelines; outputs committed under `public/data`
- `tests/unit` vitest, `tests/e2e` Playwright

See CREDITS.md for data and imagery licenses.
