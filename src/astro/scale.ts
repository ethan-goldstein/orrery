/**
 * Scale morph between "illustrated" (compressed distances, enlarged bodies)
 * and "true" scale. Everything blends in log space so the ordering of orbits
 * and the relative sizes of bodies are preserved at every intermediate value.
 *
 * Scene unit: 1 unit = 1000 km (see FloatingOrigin.unitsPerKm).
 */
export const AU_KM = 149_597_870.7;
export const UNITS_PER_KM = 1e-3;
export const AU_UNITS = AU_KM * UNITS_PER_KM;

/** Illustrated orbital distance for a true distance in km. Monotonic. */
export function illustratedDistanceUnits(km: number): number {
  const au = km / AU_KM;
  return 62_000 * Math.log1p(au * 7.5);
}

/** Log-space blend. s = 0 illustrated, s = 1 true. */
export function blendLog(illustrated: number, trueValue: number, s: number): number {
  if (illustrated <= 0 || trueValue <= 0) return illustrated + (trueValue - illustrated) * s;
  return Math.exp(Math.log(illustrated) + (Math.log(trueValue) - Math.log(illustrated)) * s);
}

/** Position blend: scales the vector's length, keeps its direction. */
export function blendPosition(
  kmVec: readonly [number, number, number],
  illustratedRadiusUnits: number,
  s: number,
): [number, number, number] {
  const km = Math.hypot(kmVec[0], kmVec[1], kmVec[2]);
  if (km === 0) return [0, 0, 0];
  const trueUnits = km * UNITS_PER_KM;
  const units = blendLog(illustratedRadiusUnits, trueUnits, s);
  const k = units / km;
  return [kmVec[0] * k, kmVec[1] * k, kmVec[2] * k];
}

export const quintic = (t: number): number => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
