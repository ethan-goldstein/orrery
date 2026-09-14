/**
 * Reference frames.
 *
 * astronomy-engine returns vectors in EQJ (J2000 mean equator and equinox).
 * The scene uses the J2000 ecliptic with Y up: scene = (x_ecl, z_ecl, -y_ecl).
 * Ecliptic north (+z_ecl) becomes scene +Y; the vernal equinox (+x) is +X.
 */
export const OBLIQUITY_J2000_DEG = 23.4392911;
const EPS = (OBLIQUITY_J2000_DEG * Math.PI) / 180;
const COS_EPS = Math.cos(EPS);
const SIN_EPS = Math.sin(EPS);

export type Vec3 = readonly [number, number, number];

/** Rotate an EQJ vector into the J2000 ecliptic frame (rotation about +x by -ε). */
export function eqjToEcl(v: Vec3): [number, number, number] {
  const [x, y, z] = v;
  return [x, COS_EPS * y + SIN_EPS * z, -SIN_EPS * y + COS_EPS * z];
}

/** Ecliptic (x, y, z) -> scene (x, z, -y). */
export function eclToScene(v: Vec3): [number, number, number] {
  return [v[0], v[2], -v[1]];
}

export function eqjToScene(v: Vec3): [number, number, number] {
  return eclToScene(eqjToEcl(v));
}

/** Right ascension (hours) and declination (degrees) -> EQJ unit vector. */
export function raDecToEqj(raHours: number, decDeg: number): [number, number, number] {
  const ra = (raHours * Math.PI) / 12;
  const dec = (decDeg * Math.PI) / 180;
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}
