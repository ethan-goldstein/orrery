import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyOrientation } from '@/astro/rotation';
import { planetPositionKm } from '@/astro/ephemeris';
import { blendLog, blendPosition, illustratedDistanceUnits, AU_KM } from '@/astro/scale';

describe('rotation', () => {
  it('tilts Earth by about 23.4 degrees from ecliptic north', () => {
    const o = bodyOrientation('earth', Date.UTC(2026, 8, 14))!;
    const tilt = (Math.acos(o.north.y) * 180) / Math.PI;
    expect(tilt).toBeCloseTo(23.44, 1);
  });
  it('tips Uranus almost onto its side', () => {
    const o = bodyOrientation('uranus', Date.UTC(2026, 8, 14))!;
    const tilt = (Math.acos(o.north.y) * 180) / Math.PI;
    // astronomy-engine reports the angular-momentum pole (82.3 deg); IAU north is its mirror (97.8 deg)
    expect(Math.abs(tilt - 90)).toBeGreaterThan(6);
    expect(Math.abs(tilt - 90)).toBeLessThan(10);
  });
  it('spins Earth once per sidereal day', () => {
    const ms = Date.UTC(2026, 8, 14);
    const a = bodyOrientation('earth', ms)!;
    const b = bodyOrientation('earth', ms + 86_164_090)!; // one sidereal day
    const pmA = new THREE.Vector3(1, 0, 0).applyQuaternion(a.quaternion);
    const pmB = new THREE.Vector3(1, 0, 0).applyQuaternion(b.quaternion);
    expect(pmA.angleTo(pmB)).toBeLessThan(0.002);
    const c = bodyOrientation('earth', ms + 6 * 3_600_000)!;
    const pmC = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    expect((pmA.angleTo(pmC) * 180) / Math.PI).toBeCloseTo(90.2, 0);
  });
  it('puts the sub-solar point on the day side at noon in Greenwich', () => {
    // 2026-06-21 12:00 UTC: Sun is over longitude ~0, latitude +23.4
    const ms = Date.UTC(2026, 5, 21, 12);
    const o = bodyOrientation('earth', ms)!;
    const pm = new THREE.Vector3(1, 0, 0).applyQuaternion(o.quaternion); // Greenwich meridian on the equator
    const earth = planetPositionKm('earth', ms);
    const toSun = new THREE.Vector3(-earth[0], -earth[1], -earth[2]).normalize();
    expect(pm.dot(toSun)).toBeGreaterThan(0.85);
  });
});

describe('scale morph', () => {
  it('endpoints are exact', () => {
    expect(blendLog(10, 1000, 0)).toBeCloseTo(10, 9);
    expect(blendLog(10, 1000, 1)).toBeCloseTo(1000, 9);
    expect(blendLog(10, 1000, 0.5)).toBeCloseTo(100, 9);
  });
  it('illustrated distances keep planet order and stay finite', () => {
    const au = [0.39, 0.72, 1, 1.52, 5.2, 9.5, 19.2, 30.1];
    const d = au.map((a) => illustratedDistanceUnits(a * AU_KM));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1]!);
    expect(d[7]! / d[0]!).toBeLessThan(6);
  });
  it('position blend keeps direction', () => {
    const p = blendPosition([3e8, 4e8, 0], 1000, 0.3);
    expect(p[0] / p[1]).toBeCloseTo(0.75, 9);
    expect(p[2]).toBe(0);
  });
});
