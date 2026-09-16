import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { anchoredTarget, easeInOutCubic, easeOutQuint, flightDuration, formatDistanceKm, liftFor, normalizeWheel, NOTCH, smoothDamp, smoothDampVec3, softClamp } from '@/engine/motion';

const settle = (hz: number, smoothTime: number, from: number, to: number) => {
  const ref = { v: 0 };
  let x = from;
  const dt = 1 / hz;
  const trace: number[] = [];
  for (let t = 0; t < 4 * smoothTime; t += dt) {
    x = smoothDamp(x, to, ref, smoothTime, dt);
    trace.push(x);
  }
  return trace;
};

describe('smoothDamp', () => {
  for (const hz of [60, 20]) {
    it(`converges monotonically without overshoot at ${hz} Hz`, () => {
      const trace = settle(hz, 0.25, 0, 10);
      for (let i = 1; i < trace.length; i++) expect(trace[i]!).toBeGreaterThanOrEqual(trace[i - 1]!);
      for (const x of trace) expect(x).toBeLessThanOrEqual(10);
      expect(trace[trace.length - 1]!).toBeGreaterThan(9.9);
    });
  }
  it('works downward too', () => {
    const trace = settle(60, 0.25, 10, 0);
    for (let i = 1; i < trace.length; i++) expect(trace[i]!).toBeLessThanOrEqual(trace[i - 1]!);
    expect(trace[trace.length - 1]!).toBeLessThan(0.1);
  });
  it('smoothDampVec3 moves every component', () => {
    const cur = new THREE.Vector3(0, 0, 0);
    const goal = new THREE.Vector3(1, -2, 3);
    const vel = new THREE.Vector3();
    for (let i = 0; i < 120; i++) smoothDampVec3(cur, goal, vel, 0.2, 1 / 60);
    expect(cur.distanceTo(goal)).toBeLessThan(0.02);
  });
});

describe('easing', () => {
  it('ease-in-out cubic and ease-out quint start at 0 and end at 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(easeOutQuint(0)).toBe(0);
    expect(easeOutQuint(1)).toBe(1);
    expect(easeOutQuint(0.5)).toBeGreaterThan(0.9);
  });
});

describe('softClamp', () => {
  it('is the identity inside and bounded by the slack outside', () => {
    expect(softClamp(3, 0, 10, 1)).toBe(3);
    expect(softClamp(0, 0, 10, 1)).toBe(0);
    for (const x of [11, 15, 100, 1e6]) {
      const y = softClamp(x, 0, 10, 1);
      expect(y).toBeGreaterThan(10);
      expect(y).toBeLessThanOrEqual(11);
    }
    for (const x of [-1, -50]) {
      const y = softClamp(x, 0, 10, 1);
      expect(y).toBeLessThan(0);
      expect(y).toBeGreaterThanOrEqual(-1);
    }
  });
});

describe('normalizeWheel', () => {
  it('turns pixels, lines and pages into notches', () => {
    expect(normalizeWheel({ deltaY: 100, deltaMode: 0 })).toBe(1);
    expect(normalizeWheel({ deltaY: -50, deltaMode: 0 })).toBe(-0.5);
    expect(normalizeWheel({ deltaY: 3, deltaMode: 1 })).toBeCloseTo(0.48, 9);
    expect(normalizeWheel({ deltaY: 1, deltaMode: 2 }, 800)).toBe(3);
  });
  it('boosts trackpad pinch (ctrl) and caps at ±3', () => {
    expect(normalizeWheel({ deltaY: 10, deltaMode: 0, ctrlKey: true })).toBeCloseTo(0.3, 9);
    expect(normalizeWheel({ deltaY: 5000, deltaMode: 0 })).toBe(3);
    expect(normalizeWheel({ deltaY: -5000, deltaMode: 0 })).toBe(-3);
  });
  it('one notch is about 12 %', () => {
    expect(Math.exp(NOTCH)).toBeCloseTo(1.12, 9);
  });
});

const pose = (theta: number, phi: number, distance: number, target = new THREE.Vector3()) => ({ theta, phi, distance, target });

describe('flightDuration', () => {
  it('stays within 0.9–2.6 s', () => {
    expect(flightDuration(pose(0, 1, 10), pose(0, 1, 10))).toBeCloseTo(0.9, 9);
    expect(flightDuration(pose(0, 1, 1), pose(Math.PI, 2.1, 1e6, new THREE.Vector3(1e7, 0, 0)))).toBeCloseTo(2.6, 9);
  });
  it('grows with the angle and with the zoom ratio', () => {
    const a = flightDuration(pose(0, 1.2, 10), pose(0.3, 1.2, 10));
    const b = flightDuration(pose(0, 1.2, 10), pose(1.5, 1.2, 10));
    expect(b).toBeGreaterThan(a);
    const c = flightDuration(pose(0, 1.2, 10), pose(0, 1.2, 100));
    const d = flightDuration(pose(0, 1.2, 10), pose(0, 1.2, 1000));
    expect(d).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(flightDuration(pose(0, 1.2, 10), pose(0, 1.2, 10)));
  });
});

describe('liftFor', () => {
  it('is zero under reduced motion and when the target stays put', () => {
    expect(liftFor(pose(0, 1, 10), pose(1, 2, 100), true)).toBe(0);
    expect(liftFor(pose(0, 1, 10), pose(1, 2, 100), false)).toBe(0);
  });
  it('arcs when the target moves', () => {
    const l = liftFor(pose(0, 1, 10), pose(0, 1, 10, new THREE.Vector3(10, 0, 0)), false);
    expect(l).toBeCloseTo(Math.log(2.2), 9);
  });
});

describe('anchoredTarget', () => {
  it('is the identity at k = 1 and reaches the point as k → 0', () => {
    const t = new THREE.Vector3(1, 2, 3);
    const p = new THREE.Vector3(-4, 0, 9);
    expect(anchoredTarget(t, p, 1).distanceTo(t)).toBeLessThan(1e-12);
    expect(anchoredTarget(t, p, 0).distanceTo(p)).toBeLessThan(1e-12);
    expect(anchoredTarget(t, p, 0.5).distanceTo(new THREE.Vector3(-1.5, 1, 6))).toBeLessThan(1e-12);
  });
  it('keeps the cursor point fixed: C′ = P + k(C − P)', () => {
    const theta = 0.7;
    const phi = 1.1;
    const u = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const t = new THREE.Vector3(0, 0, 0);
    const d = 20;
    const c = t.clone().addScaledVector(u, d);
    const p = new THREE.Vector3(2, 1, -1);
    const k = 0.6;
    const t2 = anchoredTarget(t, p, k);
    const c2 = t2.clone().addScaledVector(u, d * k);
    const expected = p.clone().add(c.clone().sub(p).multiplyScalar(k));
    expect(c2.distanceTo(expected)).toBeLessThan(1e-12);
  });
});

describe('formatDistanceKm', () => {
  it('picks km, million km or AU', () => {
    expect(formatDistanceKm(12_430.4)).toBe('12,430 km');
    expect(formatDistanceKm(1_520_000)).toBe('1.52 million km');
    expect(formatDistanceKm(149_597_870.7 * 3.21)).toBe('3.21 AU');
  });
});
