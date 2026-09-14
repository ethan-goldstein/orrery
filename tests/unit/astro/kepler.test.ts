import { describe, expect, it } from 'vitest';
import { elementsFromState, propagate, samplePath, solveKepler } from '@/astro/kepler';

const MU_EARTH = 398_600.4418;

describe('kepler', () => {
  it('solves Kepler’s equation', () => {
    for (const e of [0, 0.1, 0.5, 0.9, 0.99]) {
      for (let M = 0; M < 6.28; M += 0.7) {
        const E = solveKepler(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 9);
      }
    }
  });
  it('round-trips a circular equatorial orbit', () => {
    const r: [number, number, number] = [7000, 0, 0];
    const vc = Math.sqrt(MU_EARTH / 7000);
    const v: [number, number, number] = [0, vc, 0];
    const el = elementsFromState(r, v, MU_EARTH, 0);
    expect(el.a).toBeCloseTo(7000, 6);
    expect(el.e).toBeLessThan(1e-9);
    const p = propagate(el, 0);
    expect(p.r[0]).toBeCloseTo(7000, 3);
    const quarter = (Math.PI / 2) / el.n * 1000;
    const q = propagate(el, quarter);
    expect(q.r[0]).toBeCloseTo(0, 2);
    expect(q.r[1]).toBeCloseTo(7000, 2);
  });
  it('round-trips an inclined eccentric orbit', () => {
    const r: [number, number, number] = [-6045, -3490, 2500];
    const v: [number, number, number] = [-3.457, 6.618, 2.533];
    const el = elementsFromState(r, v, MU_EARTH, 5000);
    // classic Curtis example 4.3
    expect(el.a).toBeCloseTo(8788, 0);
    expect(el.e).toBeCloseTo(0.1712, 3);
    expect((el.i * 180) / Math.PI).toBeCloseTo(153.2, 0);
    const p = propagate(el, 5000);
    for (let k = 0; k < 3; k++) {
      expect(p.r[k]).toBeCloseTo(r[k]!, 3);
      expect(p.v[k]).toBeCloseTo(v[k]!, 6);
    }
  });
  it('samples a closed path', () => {
    const el = elementsFromState([7000, 0, 0], [0, 7.5, 1], MU_EARTH, 0);
    const path = samplePath(el, 0, 90);
    expect(path).toHaveLength(91);
    const first = path[0]!;
    const last = path[90]!;
    expect(Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2])).toBeLessThan(1e-3);
  });
});
