import * as THREE from 'three';
import { WorldExperience, latLon, type Site } from '@/experiences/world/WorldExperience';
import type { ExperienceContext } from '@/engine/Experience';
import type { Handoff } from '@/engine/Journey';
import { loadTexture } from '@/engine/Assets';
import { createEarthMaterial } from '@/engine/materials/EarthMaterial';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import { bodyOrientation } from '@/astro/rotation';
import { moonPositionKm, planetPositionKm } from '@/astro/ephemeris';
import { moonStore } from '@/store/moon';
import type { WorldState } from '@/store/world';

export type { Site };
export { latLon };

const R = 1.7374;

/**
 * The Moon, oriented so the sub-Earth point faces +X: IAU pole and spin give
 * real libration and phase for the date, Earth hangs in the sky with its
 * true phase, and arriving from Earth is a flight into lunar orbit.
 */
export class MoonExperience extends WorldExperience {
  readonly id = 'moon';
  private earth: THREE.Mesh | null = null;
  private earthAtmo: ReturnType<typeof createAtmosphereShells> | null = null;

  constructor() {
    super(
      {
        id: 'moon',
        radiusKm: 1737.4,
        radiusUnits: R,
        textures: { color: 'moon-lroc', fallback: 'moon', normal: 'moon-normal', normalScale: 1.4 },
        sitesUrl: 'data/moon/sites.json',
        presets: {
          near: { lat: 5, lon: 0, distance: R * 3.2 },
          far: { lat: 0, lon: 180, distance: R * 3.2, light: 0 },
          south: { lat: -80, lon: 0, distance: R * 2.6, light: 0 },
          terminator: { lat: 10, lon: 60, distance: R * 2.4, light: 55 },
        },
        tour: ['near', 'apollo11', 'apollo17', 'terminator', 'far', 'change4', 'south', 'chandrayaan3'],
        lightOffsetDeg: 40,
        siteDistance: R * 1.9,
        maxDistance: R * 14,
      },
      moonStore,
    );
  }

  private frameQ(ms: number): THREE.Quaternion {
    const rel = moonPositionKm(ms);
    const toEarth = new THREE.Vector3(-rel[0], -rel[1], -rel[2]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(toEarth, new THREE.Vector3(1, 0, 0));
  }

  protected orientation(ms: number): { globe: THREE.Quaternion; frame: THREE.Quaternion } {
    const frame = this.frameQ(ms);
    const o = bodyOrientation('moon', ms);
    return { globe: o ? frame.clone().multiply(o.quaternion) : frame.clone(), frame };
  }

  protected realSun(ms: number, frame: THREE.Quaternion): THREE.Vector3 {
    const e = planetPositionKm('earth', ms);
    const rel = moonPositionKm(ms);
    return new THREE.Vector3(-(e[0] + rel[0]), -(e[1] + rel[1]), -(e[2] + rel[2])).normalize().applyQuaternion(frame);
  }

  protected override arriveFrom(h: Handoff, ctx: ExperienceContext): void {
    if (h.bodyId !== 'earth') return;
    // the lunar flight: leave Earth's side and fall into orbit around the Moon
    this.rig.limits.maxDistance = R * 24;
    this.rig.importPose({ theta: Math.PI / 2 + 0.35, phi: 1.3, distance: R * 20, target: new THREE.Vector3() });
    this.acceptedHandoff = true;
    ctx.renderer.canvas.dataset.arrival = 'flying';
    const p = this.config.presets.near!;
    void this.rig.flyTo({ phi: ((90 - p.lat) * Math.PI) / 180, theta: ((p.lon + 90) * Math.PI) / 180, distance: p.distance }, 1.8).then(() => {
      this.rig.limits.maxDistance = this.config.maxDistance;
      ctx.renderer.canvas.dataset.arrival = 'done';
    });
  }

  protected override async loadExtras(ctx: ExperienceContext): Promise<void> {
    const [day, night, clouds, specular] = await Promise.all([loadTexture('earth-day', '2k'), loadTexture('earth-night', '1k').catch(() => null), loadTexture('earth-clouds', '1k').catch(() => null), loadTexture('earth-specular', '1k').catch(() => null)]);
    if (ctx.signal.aborted) return;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(6.371, 96, 64), createEarthMaterial({ day, night, normal: null, specular, clouds }));
    this.earthAtmo = createAtmosphereShells('#6fb1ff', '#ff7a3d', 0.035);
    this.earthAtmo.inner.scale.multiplyScalar(6.371);
    this.earthAtmo.outer.scale.multiplyScalar(6.371);
    this.earth.add(this.earthAtmo.inner, this.earthAtmo.outer);
    this.scene.add(this.earth);
  }

  protected override updateCompanions(ms: number, frame: THREE.Quaternion, sun: THREE.Vector3, state: WorldState): void {
    if (!this.earth) return;
    // staged composition: Earth along +X at a compressed distance, real relative radius and phase
    this.earth.position.set(R * 22, R * 4, 0);
    const eo = bodyOrientation('earth', ms);
    if (eo) this.earth.quaternion.copy(frame).multiply(eo.quaternion);
    const preset = this.config.presets[state.preset];
    const site = this.sites.find((s) => s.id === state.site);
    const lon = site ? site.lon : (preset?.lon ?? 0);
    this.earth.visible = state.companions && Math.abs(((lon + 540) % 360) - 180) > 85;
    const em = this.earth.material as THREE.ShaderMaterial;
    em.uniforms.uSunDir!.value.copy(sun);
    em.uniforms.uSunIntensity!.value = 2.2;
    this.earthAtmo?.setSun(sun);
  }

  override unmount(): void {
    this.earthAtmo?.dispose();
    super.unmount();
  }
}
