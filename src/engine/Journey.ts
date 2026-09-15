import * as THREE from 'three';

/**
 * Camera handoff between experiences. A pose is expressed relative to a body
 * in the shared ecliptic Y-up frame, with the distance normalised by the
 * body's real radius so it survives the illustrated/true scale morph.
 */
export interface Handoff {
  from: string;
  bodyId: string;
  /** camera distance from the body centre, in km, as if the body were at true scale */
  distanceKm: number;
  /** spherical angles around the body in the shared frame (CameraRig convention) */
  theta: number;
  phi: number;
  epochMs: number;
  /** performance.now() when exported; stale handoffs are ignored */
  at: number;
}

export const HANDOFF_MAX_AGE_MS = 5000;

const tmp = new THREE.Vector3();

/** CameraRig spherical -> unit direction from the target to the camera. */
export function directionFromSpherical(theta: number, phi: number, out = new THREE.Vector3()): THREE.Vector3 {
  const s = Math.sin(phi);
  return out.set(s * Math.sin(theta), Math.cos(phi), s * Math.cos(theta));
}

/** Unit direction -> CameraRig spherical. */
export function sphericalFromDirection(d: THREE.Vector3): { theta: number; phi: number } {
  const n = tmp.copy(d).normalize();
  return { theta: Math.atan2(n.x, n.z), phi: Math.acos(Math.min(1, Math.max(-1, n.y))) };
}

/**
 * Convert a handoff into a rig pose for a body drawn with `radiusUnits`.
 * `frameQ` rotates shared-frame directions into the experience's local frame
 * (identity for Solar and Earth; the Moon page rotates its whole scene).
 */
export function poseFromHandoff(h: Handoff, radiusKm: number, radiusUnits: number, frameQ?: THREE.Quaternion): { theta: number; phi: number; distance: number } {
  const dir = directionFromSpherical(h.theta, h.phi);
  if (frameQ) dir.applyQuaternion(frameQ);
  const { theta, phi } = sphericalFromDirection(dir);
  return { theta, phi, distance: (h.distanceKm / radiusKm) * radiusUnits };
}

/** Build a handoff from a rig pose; `frameQ` is the same rotation as above (it is inverted here). */
export function handoffFromPose(from: string, bodyId: string, pose: { theta: number; phi: number; distance: number }, radiusKm: number, radiusUnits: number, epochMs: number, frameQ?: THREE.Quaternion): Handoff {
  const dir = directionFromSpherical(pose.theta, pose.phi);
  if (frameQ) dir.applyQuaternion(frameQ.clone().invert());
  const { theta, phi } = sphericalFromDirection(dir);
  return { from, bodyId, distanceKm: (pose.distance / radiusUnits) * radiusKm, theta, phi, epochMs, at: performance.now() };
}
