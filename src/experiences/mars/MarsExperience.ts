import * as THREE from 'three';
import { WorldExperience, type Site } from '@/experiences/world/WorldExperience';
import type { ExperienceContext } from '@/engine/Experience';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import { createPlanetMaterial } from '@/engine/materials/PlanetMaterial';
import { bodyOrientation } from '@/astro/rotation';
import { keplerMoonPositionKm, loadKeplerMoons, planetPositionKm } from '@/astro/ephemeris';
import { marsStore } from '@/store/mars';
import type { WorldState } from '@/store/world';

export type { Site };

const R = 3.3895;
const UNITS_PER_KM = 1e-3;

/**
 * Mars: IAU orientation for the date, a thin dusty atmosphere whose haze
 * follows a dust slider, and Phobos and Deimos at their real positions.
 */
export class MarsExperience extends WorldExperience {
  readonly id = 'mars';
  private atmo: ReturnType<typeof createAtmosphereShells> | null = null;
  private moons: { id: string; mesh: THREE.Mesh; scale: number }[] = [];

  constructor() {
    super(
      {
        id: 'mars',
        radiusKm: 3389.5,
        radiusUnits: R,
        textures: { color: 'mars' },
        sitesUrl: 'data/mars/sites.json',
        presets: {
          global: { lat: 10, lon: -80, distance: R * 3.2 },
          olympus: { lat: 18.65, lon: -133.8, distance: R * 1.6, light: 35 },
          marineris: { lat: -12, lon: -68, distance: R * 1.7, light: 30 },
          polar: { lat: 85, lon: 0, distance: R * 2.2, light: 0 },
          hellas: { lat: -42.4, lon: 70.5, distance: R * 1.9, light: 30 },
        },
        tour: ['global', 'olympus', 'marineris', 'perseverance', 'curiosity', 'polar', 'viking1', 'hellas'],
        lightOffsetDeg: 35,
        siteDistance: R * 1.6,
        maxDistance: R * 14,
      },
      marsStore,
    );
  }

  protected orientation(ms: number): { globe: THREE.Quaternion; frame: THREE.Quaternion } {
    const o = bodyOrientation('mars', ms);
    return { globe: o ? o.quaternion.clone() : new THREE.Quaternion(), frame: new THREE.Quaternion() };
  }

  protected realSun(ms: number): THREE.Vector3 {
    const m = planetPositionKm('mars', ms);
    return new THREE.Vector3(-m[0], -m[1], -m[2]).normalize();
  }

  protected override async loadExtras(ctx: ExperienceContext): Promise<void> {
    this.atmo = createAtmosphereShells('#d9a07a', '#ffb070', 0.02);
    this.atmo.inner.scale.multiplyScalar(R);
    this.atmo.outer.scale.multiplyScalar(R);
    this.scene.add(this.atmo.inner, this.atmo.outer);
    await loadKeplerMoons(ctx.signal).catch(() => undefined);
    if (ctx.signal.aborted) return;
    // Phobos (11 km) and Deimos (6 km) would be invisible at true size: drawn 60x larger, positions real
    for (const [id, radiusKm, color] of [
      ['phobos', 11.1, '#8c7f74'],
      ['deimos', 6.2, '#9c8f82'],
    ] as const) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), createPlanetMaterial({ color, procedural: true, roughness: 1 }));
      const scale = radiusKm * UNITS_PER_KM * 60;
      mesh.scale.setScalar(scale);
      mesh.name = id;
      this.scene.add(mesh);
      this.moons.push({ id, mesh, scale });
    }
  }

  protected override updateCompanions(ms: number, _frame: THREE.Quaternion, sun: THREE.Vector3, state: WorldState): void {
    for (const m of this.moons) {
      const rel = keplerMoonPositionKm(m.id, ms);
      m.mesh.visible = !!rel && state.companions;
      if (rel) m.mesh.position.set(rel[0] * UNITS_PER_KM, rel[1] * UNITS_PER_KM, rel[2] * UNITS_PER_KM);
      const su = (m.mesh.material as THREE.MeshStandardMaterial & { shadowUniforms?: { uSunPos: { value: number[] }; uSunRadius: { value: number }; uCasterCount: { value: number }; uCasters: { value: Float32Array } } }).shadowUniforms;
      if (su) {
        su.uSunPos.value = [sun.x * 5000, sun.y * 5000, sun.z * 5000];
        su.uSunRadius.value = 20;
        su.uCasterCount.value = 1;
        su.uCasters.value.set([0, 0, 0, R], 0);
      }
    }
    if (this.atmo) {
      this.atmo.setSun(sun);
      // dust: thicker, warmer haze and a duller surface
      const d = state.dust;
      for (const shell of [this.atmo.inner, this.atmo.outer]) {
        const u = (shell.material as THREE.ShaderMaterial).uniforms;
        u.uAlpha!.value = (shell === this.atmo.inner ? 0.35 : 0.25) * (0.6 + 1.6 * d);
        (u.uColor!.value as THREE.Color).set('#d9a07a').lerp(new THREE.Color('#c98a55'), d);
      }
      const mat = this.globe.material as THREE.MeshStandardMaterial;
      mat.color.setScalar(1).lerp(new THREE.Color('#c9a184'), d * 0.55);
    }
  }

  override unmount(): void {
    this.atmo?.dispose();
    super.unmount();
  }
}
