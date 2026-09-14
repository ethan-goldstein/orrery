import * as THREE from 'three';
import { Body, RotationAxis } from 'astronomy-engine';
import { eqjToScene } from './frames';

const ENGINE_BODY: Record<string, Body> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  moon: Body.Moon,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

export interface Orientation {
  quaternion: THREE.Quaternion;
  /** north pole direction in scene frame */
  north: THREE.Vector3;
  /** IAU prime-meridian angle W in degrees */
  spinDeg: number;
}

const tmpQ = new THREE.Matrix4();

/**
 * IAU orientation of a body at a date, as a scene-frame quaternion that maps
 * mesh +Y to the north pole and mesh +X to the prime meridian (the centre of
 * an equirectangular texture in three's SphereGeometry).
 *
 * `textureOffsetDeg` corrects maps whose centre column is not longitude 0.
 */
export function bodyOrientation(id: string, ms: number, textureOffsetDeg = 0): Orientation | null {
  const body = ENGINE_BODY[id];
  if (!body) return null;
  const axis = RotationAxis(body, new Date(ms));
  const n = [axis.north.x, axis.north.y, axis.north.z] as const;
  // Node Q: intersection of the body equator with the ICRF equator = Z_icrf x north
  let qx = -n[1];
  let qy = n[0];
  let qz = 0;
  const qLen = Math.hypot(qx, qy, qz);
  if (qLen < 1e-9) {
    qx = 1;
    qy = 0;
    qz = 0;
  } else {
    qx /= qLen;
    qy /= qLen;
  }
  const W = ((axis.spin + textureOffsetDeg) * Math.PI) / 180;
  // prime meridian = rotate Q about north by W
  const c = Math.cos(W);
  const s = Math.sin(W);
  const nxq = [n[1] * qz - n[2] * qy, n[2] * qx - n[0] * qz, n[0] * qy - n[1] * qx];
  const pm = [qx * c + nxq[0]! * s, qy * c + nxq[1]! * s, qz * c + nxq[2]! * s] as const;
  const northScene = eqjToScene(n);
  const pmScene = eqjToScene(pm);
  const X = new THREE.Vector3(...pmScene).normalize();
  const Y = new THREE.Vector3(...northScene).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  X.crossVectors(Y, Z).normalize();
  tmpQ.makeBasis(X, Y, Z);
  return { quaternion: new THREE.Quaternion().setFromRotationMatrix(tmpQ), north: Y, spinDeg: axis.spin };
}

export function hasIauOrientation(id: string): boolean {
  return id in ENGINE_BODY;
}
