/**
 * Two-body Keplerian propagation from an osculating state vector.
 * Frame-agnostic: whatever frame the state is in, the output is in.
 */
export interface Elements {
  a: number; // km
  e: number;
  i: number; // rad
  raan: number; // rad, longitude of ascending node
  argp: number; // rad, argument of periapsis
  m0: number; // rad, mean anomaly at epoch
  n: number; // rad/s, mean motion
  epochMs: number;
  mu: number; // km^3/s^2
}

const TWO_PI = Math.PI * 2;

export function elementsFromState(
  r: readonly [number, number, number],
  v: readonly [number, number, number],
  mu: number,
  epochMs: number,
): Elements {
  const rMag = Math.hypot(...r);
  const vMag = Math.hypot(...v);
  const h = cross(r, v);
  const hMag = Math.hypot(...h);
  const nVec: [number, number, number] = [-h[1], h[0], 0];
  const nMag = Math.hypot(...nVec);
  const rv = dot(r, v);
  const eVec: [number, number, number] = [
    ((vMag * vMag - mu / rMag) * r[0] - rv * v[0]) / mu,
    ((vMag * vMag - mu / rMag) * r[1] - rv * v[1]) / mu,
    ((vMag * vMag - mu / rMag) * r[2] - rv * v[2]) / mu,
  ];
  const e = Math.hypot(...eVec);
  const energy = (vMag * vMag) / 2 - mu / rMag;
  const a = -mu / (2 * energy);
  const i = Math.acos(clamp(h[2] / hMag, -1, 1));
  const circular = e < 1e-9;
  const equatorial = nMag < 1e-9;
  let raan: number, argp: number, nu: number;
  if (equatorial) {
    raan = 0;
    if (circular) {
      argp = 0;
      nu = Math.atan2(r[1], r[0]);
      if (h[2] < 0) nu = TWO_PI - nu;
    } else {
      argp = Math.atan2(eVec[1], eVec[0]);
      if (h[2] < 0) argp = TWO_PI - argp;
      nu = Math.acos(clamp(dot(eVec, r) / (e * rMag), -1, 1));
      if (rv < 0) nu = TWO_PI - nu;
    }
  } else {
    raan = Math.atan2(nVec[1], nVec[0]);
    if (circular) {
      argp = 0;
      nu = Math.acos(clamp(dot(nVec, r) / (nMag * rMag), -1, 1));
      if (r[2] < 0) nu = TWO_PI - nu;
    } else {
      argp = Math.acos(clamp(dot(nVec, eVec) / (nMag * e), -1, 1));
      if (eVec[2] < 0) argp = TWO_PI - argp;
      nu = Math.acos(clamp(dot(eVec, r) / (e * rMag), -1, 1));
      if (rv < 0) nu = TWO_PI - nu;
    }
  }
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  const m0 = norm(E - e * Math.sin(E));
  const n = Math.sqrt(mu / (a * a * a));
  return { a, e, i, raan: norm(raan), argp: norm(argp), m0, n, epochMs, mu };
}

export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const d = 1 - e * Math.cos(E);
    const dE = f / d;
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Position and velocity at time t (ms). */
export function propagate(el: Elements, tMs: number): { r: [number, number, number]; v: [number, number, number] } {
  const M = norm(el.m0 + el.n * ((tMs - el.epochMs) / 1000));
  const E = solveKepler(M, el.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrt1me2 = Math.sqrt(1 - el.e * el.e);
  // perifocal
  const xp = el.a * (cosE - el.e);
  const yp = el.a * sqrt1me2 * sinE;
  const rMag = el.a * (1 - el.e * cosE);
  const k = Math.sqrt(el.mu * el.a) / rMag;
  const vxp = -k * sinE;
  const vyp = k * sqrt1me2 * cosE;
  const [cO, sO, ci, si, cw, sw] = [Math.cos(el.raan), Math.sin(el.raan), Math.cos(el.i), Math.sin(el.i), Math.cos(el.argp), Math.sin(el.argp)];
  // rotation perifocal -> reference: Rz(raan) Rx(i) Rz(argp)
  const r11 = cO * cw - sO * sw * ci;
  const r12 = -cO * sw - sO * cw * ci;
  const r21 = sO * cw + cO * sw * ci;
  const r22 = -sO * sw + cO * cw * ci;
  const r31 = sw * si;
  const r32 = cw * si;
  return {
    r: [r11 * xp + r12 * yp, r21 * xp + r22 * yp, r31 * xp + r32 * yp],
    v: [r11 * vxp + r12 * vyp, r21 * vxp + r22 * vyp, r31 * vxp + r32 * vyp],
  };
}

/** Sample one full orbit (positions) for path guides. */
export function samplePath(el: Elements, tMs: number, samples = 180): [number, number, number][] {
  const periodMs = (TWO_PI / el.n) * 1000;
  const out: [number, number, number][] = [];
  for (let k = 0; k <= samples; k++) out.push(propagate(el, tMs + (periodMs * k) / samples).r);
  return out;
}

export const period = (el: Elements): number => TWO_PI / el.n;

function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}
function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
function norm(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}
