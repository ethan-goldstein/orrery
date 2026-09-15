import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Trajectory, jdToMs } from '@/astro/trajectory';
import { AU_KM } from '@/astro/scale';

/** Synthetic circular heliocentric orbit at 1 AU sampled every 30 days (ecliptic rows). */
function circular(): number[][] {
  const rows: number[][] = [];
  const r = AU_KM;
  const T = 365.25 * 86400;
  const w = (2 * Math.PI) / T;
  for (let d = 0; d <= 730; d += 30) {
    const t = d * 86400;
    rows.push([2451545 + d, r * Math.cos(w * t), r * Math.sin(w * t), 0, -r * w * Math.sin(w * t), r * w * Math.cos(w * t), 0]);
  }
  return rows;
}

describe('trajectory', () => {
  it('interpolates a circular orbit between 30-day samples to well under 0.05 %', () => {
    const tr = new Trajectory(circular());
    const ms = jdToMs(2451545 + 15); // midway between samples
    const p = tr.at(ms)!;
    expect(Math.hypot(...p.r) / AU_KM).toBeCloseTo(1, 3);
    const err = Math.abs(Math.hypot(...p.r) - AU_KM) / AU_KM;
    expect(err).toBeLessThan(5e-4);
    expect(Math.hypot(...p.v)).toBeCloseTo(29.8, 0);
  });
  it('is null before launch and clamps after the last sample', () => {
    const tr = new Trajectory(circular());
    expect(tr.at(jdToMs(2451545 - 1))).toBeNull();
    const last = tr.at(jdToMs(2451545 + 1000))!;
    expect(Math.hypot(...last.r) / AU_KM).toBeCloseTo(1, 3);
  });
  it('slices a growing path that ends at the interpolated tip', () => {
    const tr = new Trajectory(circular());
    const a = tr.slice(jdToMs(2451545 + 100));
    const b = tr.slice(jdToMs(2451545 + 400));
    expect(b.length).toBeGreaterThan(a.length);
    const tip = tr.at(jdToMs(2451545 + 400))!.r;
    expect(a[a.length - 1]).not.toEqual(b[b.length - 1]);
    expect(b[b.length - 1]).toEqual(tip);
  });
  it('maps ecliptic rows into the scene frame (x, z, -y)', () => {
    const tr = new Trajectory([[2451545, 1, 2, 3, 0, 0, 0], [2451546, 1, 2, 3, 0, 0, 0]]);
    expect(tr.at(jdToMs(2451545))!.r).toEqual([1, 3, -2]);
  });
});

describe('committed spacecraft data', () => {
  const file = new URL('../../../public/data/solar/spacecraft.json', import.meta.url);
  const data = JSON.parse(readFileSync(file, 'utf8')) as { craft: Record<string, { rows: number[][] }> };
  it('has every craft with monotonic samples', () => {
    for (const [id, c] of Object.entries(data.craft)) {
      expect(c.rows.length, id).toBeGreaterThan(20);
      for (let i = 1; i < c.rows.length; i++) expect(c.rows[i]![0]!, `${id} row ${i}`).toBeGreaterThan(c.rows[i - 1]![0]!);
    }
  });
  it('puts Voyager 1 beyond 150 AU in 2025 and Halley near 35 AU at aphelion', () => {
    const v1 = new Trajectory(data.craft['voyager1']!.rows);
    expect(Math.hypot(...v1.at(Date.UTC(2025, 0, 1))!.r) / AU_KM).toBeGreaterThan(150);
    const halley = new Trajectory(data.craft['halley']!.rows);
    expect(Math.hypot(...halley.at(Date.UTC(2023, 11, 9))!.r) / AU_KM).toBeGreaterThan(34);
    expect(Math.hypot(...halley.at(Date.UTC(1986, 1, 9))!.r) / AU_KM).toBeLessThan(0.7);
  });
});
