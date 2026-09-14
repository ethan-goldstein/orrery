import * as THREE from 'three';

/**
 * Authoritative positions live in kilometres as Float64 triples. Each frame
 * the origin is moved to the focus body and everything is expressed relative
 * to it in Float32 scene units, so a close-up of Neptune is as precise as a
 * close-up of Earth.
 */
export class FloatingOrigin {
  readonly originKm: [number, number, number] = [0, 0, 0];
  /** scene units per kilometre */
  unitsPerKm = 1e-3;

  setOrigin(x: number, y: number, z: number): void {
    this.originKm[0] = x;
    this.originKm[1] = y;
    this.originKm[2] = z;
  }

  toScene(km: readonly [number, number, number], out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(
      (km[0] - this.originKm[0]) * this.unitsPerKm,
      (km[1] - this.originKm[1]) * this.unitsPerKm,
      (km[2] - this.originKm[2]) * this.unitsPerKm,
    );
  }

  toKm(scene: THREE.Vector3): [number, number, number] {
    return [
      scene.x / this.unitsPerKm + this.originKm[0],
      scene.y / this.unitsPerKm + this.originKm[1],
      scene.z / this.unitsPerKm + this.originKm[2],
    ];
  }
}
