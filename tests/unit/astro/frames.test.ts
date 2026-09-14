import { describe, expect, it } from 'vitest';
import { eqjToEcl, eqjToScene, raDecToEqj, OBLIQUITY_J2000_DEG } from '@/astro/frames';

describe('frames', () => {
  it('leaves the equinox direction unchanged', () => {
    const a = eqjToEcl([1, 0, 0]);
    const b = eqjToScene([1, 0, 0]);
    for (const [v, e] of [[a, [1, 0, 0]], [b, [1, 0, 0]]] as const) v.forEach((x, i) => expect(x).toBeCloseTo(e[i]!, 12));
  });
  it('maps the celestial north pole to ecliptic latitude 90 - obliquity', () => {
    const [x, y, z] = eqjToEcl([0, 0, 1]);
    const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
    expect(lat).toBeCloseTo(90 - OBLIQUITY_J2000_DEG, 6);
  });
  it('puts ecliptic north on scene +Y', () => {
    const eclNorth = eqjToScene([0, -Math.sin((OBLIQUITY_J2000_DEG * Math.PI) / 180), Math.cos((OBLIQUITY_J2000_DEG * Math.PI) / 180)]);
    expect(eclNorth[0]).toBeCloseTo(0, 9);
    expect(eclNorth[1]).toBeCloseTo(1, 9);
    expect(eclNorth[2]).toBeCloseTo(0, 9);
  });
  it('converts RA/Dec to a unit vector', () => {
    const v = raDecToEqj(6, 0); // RA 6h on the equator = +y
    expect(v[0]).toBeCloseTo(0, 9);
    expect(v[1]).toBeCloseTo(1, 9);
    expect(v[2]).toBeCloseTo(0, 9);
  });
});
