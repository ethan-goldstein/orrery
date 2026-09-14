import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { moonPositionKm, planetPositionKm, planetStateKm, galileanPositionKm, seedKeplerMoons, keplerMoonPositionKm } from '@/astro/ephemeris';
import { AU_KM } from '@/astro/scale';

type State = [number, number, number, number, number, number];
const fx = JSON.parse(readFileSync(new URL('./fixtures/horizons.json', import.meta.url), 'utf8')) as {
  fixtures: Record<string, Record<string, State>>;
};
const moonsFile = JSON.parse(readFileSync(new URL('../../../public/data/solar/moons.json', import.meta.url), 'utf8'));

/** Horizons ecliptic -> scene: (x, y, z) -> (x, z, -y) */
const toScene = (s: State): [number, number, number] => [s[0], s[2], -s[1]];
const parseWhen = (w: string) => Date.parse(w.includes(':') ? `${w.replace(' ', 'T')}:00Z` : `${w}T00:00:00Z`);
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('planet positions vs JPL Horizons', () => {
  for (const [when, bodies] of Object.entries(fx.fixtures)) {
    const ms = parseWhen(when);
    for (const [id, state] of Object.entries(bodies)) {
      if (id === 'moon') continue;
      it(`${id} at ${when}`, () => {
        const ours = planetPositionKm(id, ms);
        const ref = toScene(state);
        const r = Math.hypot(...ref);
        // astronomy-engine is arcminute-class: allow 0.05% of the distance (about 1.7 arcmin)
        expect(dist(ours, ref)).toBeLessThan(r * 5e-4 + 2000);
      });
    }
  }
  it('Earth velocity is about 30 km/s tangential', () => {
    const { r, v } = planetStateKm('earth', Date.UTC(2026, 8, 14));
    const speed = Math.hypot(...v);
    expect(speed).toBeGreaterThan(29);
    expect(speed).toBeLessThan(31);
    const radial = (r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) / Math.hypot(...r);
    expect(Math.abs(radial)).toBeLessThan(1);
  });
  it('Earth stays near 1 AU', () => {
    const r = Math.hypot(...planetPositionKm('earth', Date.UTC(2000, 0, 1, 12)));
    expect(r / AU_KM).toBeGreaterThan(0.98);
    expect(r / AU_KM).toBeLessThan(1.02);
  });
});

describe('Moon vs Horizons', () => {
  for (const [when, bodies] of Object.entries(fx.fixtures)) {
    it(`geocentric Moon at ${when}`, () => {
      const ours = moonPositionKm(parseWhen(when));
      const ref = toScene(bodies['moon']!);
      expect(dist(ours, ref)).toBeLessThan(600); // ~0.1 degree at lunar distance
    });
  }
});

describe('moons', () => {
  seedKeplerMoons(moonsFile);
  it('Kepler moons reproduce their seed state at epoch', () => {
    for (const [id, m] of Object.entries(moonsFile.moons as Record<string, { epochMs: number; state: State }>)) {
      const ours = keplerMoonPositionKm(id, m.epochMs)!;
      expect(dist(ours, toScene(m.state))).toBeLessThan(1);
    }
  });
  it('Titan orbits Saturn at about 1.2 million km with a 16 day period', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const r0 = keplerMoonPositionKm('titan', t0)!;
    const r8 = keplerMoonPositionKm('titan', t0 + 8 * 86_400_000)!;
    const r16 = keplerMoonPositionKm('titan', t0 + 15.945 * 86_400_000)!;
    expect(Math.hypot(...r0)).toBeGreaterThan(1_150_000);
    expect(Math.hypot(...r0)).toBeLessThan(1_260_000);
    expect(dist(r0, r8)).toBeGreaterThan(2_000_000); // opposite side
    expect(dist(r0, r16)).toBeLessThan(120_000); // back around
  });
  it('Galilean moons have the right orbital radii', () => {
    const ms = Date.UTC(2026, 8, 14);
    const io = Math.hypot(...galileanPositionKm('io', ms));
    const callisto = Math.hypot(...galileanPositionKm('callisto', ms));
    expect(io).toBeGreaterThan(415_000);
    expect(io).toBeLessThan(430_000);
    expect(callisto).toBeGreaterThan(1_860_000);
    expect(callisto).toBeLessThan(1_900_000);
  });
  it('Triton orbits retrograde', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const a = keplerMoonPositionKm('triton', t0)!;
    const b = keplerMoonPositionKm('triton', t0 + 3_600_000)!;
    // angular momentum about scene +Y (ecliptic north): negative means retrograde
    const hy = a[2] * b[0] - a[0] * b[2];
    expect(hy).toBeLessThan(0);
  });
});
