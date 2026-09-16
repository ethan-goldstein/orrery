import * as THREE from 'three';

/**
 * Pure motion math for the camera: easing, critically damped springs, a
 * rubber-band clamp, wheel normalisation and flight timing. No DOM, so it
 * runs under vitest's node environment.
 */

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutQuint = (t: number): number => 1 - (1 - t) ** 5;

export interface SpringRef {
  v: number;
}

/**
 * Critically damped spring toward `goal` (the Unity SmoothDamp form). Returns
 * the new value and stores the velocity in `ref`. Never overshoots.
 */
export function smoothDamp(cur: number, goal: number, ref: SpringRef, smoothTime: number, dt: number, maxSpeed = Infinity): number {
  const w = 2 / Math.max(1e-4, smoothTime);
  const x = w * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = cur - goal;
  const maxChange = maxSpeed * smoothTime;
  change = Math.min(maxChange, Math.max(-maxChange, change));
  const clampedGoal = cur - change;
  const temp = (ref.v + w * change) * dt;
  ref.v = (ref.v - w * temp) * e;
  let out = clampedGoal + (change + temp) * e;
  // clamp to the goal if we crossed it
  if (goal - cur > 0 === out > goal) {
    out = goal;
    ref.v = 0;
  }
  return out;
}

const tmpRef: SpringRef = { v: 0 };

/** Per-component smoothDamp for a Vector3; `vel` holds the velocity. Mutates `cur`. */
export function smoothDampVec3(cur: THREE.Vector3, goal: THREE.Vector3, vel: THREE.Vector3, smoothTime: number, dt: number): void {
  tmpRef.v = vel.x;
  cur.x = smoothDamp(cur.x, goal.x, tmpRef, smoothTime, dt);
  vel.x = tmpRef.v;
  tmpRef.v = vel.y;
  cur.y = smoothDamp(cur.y, goal.y, tmpRef, smoothTime, dt);
  vel.y = tmpRef.v;
  tmpRef.v = vel.z;
  cur.z = smoothDamp(cur.z, goal.z, tmpRef, smoothTime, dt);
  vel.z = tmpRef.v;
}

/** Rubber band: identity inside [lo, hi], asymptotic beyond, never past lo − slack or hi + slack. */
export function softClamp(x: number, lo: number, hi: number, slack: number): number {
  if (x > hi) return hi + slack * Math.tanh((x - hi) / slack);
  if (x < lo) return lo - slack * Math.tanh((lo - x) / slack);
  return x;
}

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export interface WheelLike {
  deltaY: number;
  deltaMode: number;
  ctrlKey?: boolean;
}

/** One notch ≈ 12 % of the camera distance. */
export const NOTCH = Math.log(1.12);

/**
 * Wheel delta in "notches" (100 px each), the same for a mouse wheel, a
 * trackpad, a line-mode browser and a page-mode browser. A Mac trackpad pinch
 * arrives as ctrl+wheel with tiny deltas, so it is boosted. Capped at ±3 so a
 * flick cannot run away.
 */
export function normalizeWheel(e: WheelLike, pageHeight = 800): number {
  let d = e.deltaY;
  if (e.deltaMode === 1) d *= 16;
  else if (e.deltaMode === 2) d *= pageHeight;
  if (e.ctrlKey) d *= 3;
  return clamp(d / 100, -3, 3);
}

export interface PoseLike {
  theta: number;
  phi: number;
  distance: number;
  target: THREE.Vector3;
}

const dirA = new THREE.Vector3();
const dirB = new THREE.Vector3();

export function direction(theta: number, phi: number, out = new THREE.Vector3()): THREE.Vector3 {
  const s = Math.sin(phi);
  return out.set(s * Math.sin(theta), Math.cos(phi), s * Math.cos(theta));
}

/** How far the target moves, as a fraction of the larger camera distance (0..1). */
function shiftOf(from: PoseLike, to: PoseLike): number {
  return Math.min(1, from.target.distanceTo(to.target) / Math.max(from.distance, to.distance, 1e-9));
}

/**
 * Flight time derived from how much changes: a small nudge is quick, a swing
 * across the system with a big zoom takes its time. Always 0.9–2.6 s.
 */
export function flightDuration(from: PoseLike, to: PoseLike): number {
  direction(from.theta, from.phi, dirA);
  direction(to.theta, to.phi, dirB);
  const ang = Math.acos(clamp(dirA.dot(dirB), -1, 1));
  const logRatio = Math.abs(Math.log(to.distance / from.distance));
  return clamp(0.55 + 0.9 * (ang / Math.PI) + 0.35 * logRatio + 0.6 * shiftOf(from, to), 0.9, 2.6);
}

/** Extra log-distance at mid-flight so a move between worlds arcs up and over instead of skimming. */
export function liftFor(from: PoseLike, to: PoseLike, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.log(1 + 1.2 * shiftOf(from, to));
}

/**
 * Zooming about a point. The camera sits at C = T + d·u. Scaling d by k while
 * keeping u, and sliding the camera along its ray toward the hit point P, gives
 * C' = P + k(C − P), hence T' = P + k(T − P). The orientation is unchanged, so
 * P stays under the cursor.
 */
export function anchoredTarget(target: THREE.Vector3, p: THREE.Vector3, k: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.subVectors(target, p).multiplyScalar(k).add(p);
}

/** "12,430 km", "1.52 million km" or "3.21 AU". */
export function formatDistanceKm(km: number): string {
  const AU = 149_597_870.7;
  if (km >= AU * 0.5) return `${(km / AU).toFixed(2)} AU`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)} million km`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
