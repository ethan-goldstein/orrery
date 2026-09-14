import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { MilkyWay } from '@/engine/MilkyWay';
import { CameraRig } from '@/engine/CameraRig';
import { Labels, type LabelEntry } from '@/engine/Labels';
import { assetUrl, loadTexture } from '@/engine/Assets';
import { createEarthMaterial } from '@/engine/materials/EarthMaterial';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import type { ClockState } from '@/astro/time';
import { bodyOrientation } from '@/astro/rotation';
import { moonPositionKm, planetPositionKm } from '@/astro/ephemeris';
import { moonStore, type MoonPreset } from '@/store/moon';

export interface Site {
  id: string;
  name: string;
  agency: string;
  date: string;
  lat: number;
  lon: number;
  kind: string;
  crew: string[] | null;
  region: string;
  blurb: string;
}

const R = 1.7374; // scene units (1000 km)
const PRESETS: Record<MoonPreset, { lat: number; lon: number; distance: number }> = {
  near: { lat: 5, lon: 0, distance: R * 3.2 },
  far: { lat: 0, lon: 180, distance: R * 3.2 },
  south: { lat: -80, lon: 0, distance: R * 2.6 },
  terminator: { lat: 10, lon: 60, distance: R * 2.4 },
};
const TOUR: (MoonPreset | string)[] = ['near', 'apollo11', 'apollo17', 'terminator', 'far', 'change4', 'south', 'chandrayaan3'];

/**
 * The Moon with LRO colour and LOLA relief, real libration and phase for the
 * simulation date, landing sites, and Earth hanging in the sky with the
 * right phase.
 */
export class MoonExperience extends Experience {
  readonly id = 'moon';
  private stars = new Starfield();
  private milkyWay: MilkyWay | null = null;
  private rig!: CameraRig;
  private labels!: Labels;
  private moon!: THREE.Mesh;
  private earth: THREE.Mesh | null = null;
  private earthAtmo: ReturnType<typeof createAtmosphereShells> | null = null;
  private sun = new THREE.DirectionalLight(0xfff6e6, 3.0);
  private markers = new THREE.Group();
  private sites: Site[] = [];
  private ready = false;
  private unsub: (() => void)[] = [];
  private tourTimer = 0;
  private tourIndex = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    this.camera.near = 0.01;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, this.sun, new THREE.AmbientLight(0x0b0d12, 0.35), this.markers);
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(R, tier.sphereSegments, tier.sphereSegments / 2), new THREE.MeshStandardMaterial({ color: 0x8a8781, roughness: 1 }));
    this.scene.add(this.moon);
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: R * 3.2, phi: 1.48, theta: Math.PI / 2 });
    this.rig.limits = { minDistance: R * 1.08, maxDistance: R * 14, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.rig.element.addEventListener('pointerdown', () => moonStore.getState().set({ tour: false }));
    this.labels = new Labels(ctx.stage);
    this.labels.onSelect = (id) => moonStore.getState().set({ site: id, tour: false });
    this.unsub.push(
      moonStore.subscribe((s, prev) => {
        if (s.preset !== prev.preset) this.flyPreset(s.preset);
        if (s.site !== prev.site && s.site) this.flySite(s.site);
        if (s.tour && !prev.tour) {
          this.tourIndex = 0;
          this.tourTimer = 0;
          this.tourStep();
        }
      }),
    );
    this.ready = true;
    this.flyPreset(moonStore.getState().preset, true);
    void this.loadAssets(ctx, tier.textureTier);
    await Promise.all([
      this.stars.load(ctx.signal).catch(() => undefined),
      fetch(assetUrl('data/moon/sites.json'), { signal: ctx.signal })
        .then((r) => r.json() as Promise<{ sites: Site[] }>)
        .then((d) => {
          this.sites = d.sites;
          this.buildMarkers();
          const s = moonStore.getState().site;
          if (s) this.flySite(s);
        })
        .catch(() => undefined),
    ]);
  }

  private async loadAssets(ctx: ExperienceContext, tier: '1k' | '2k' | '4k'): Promise<void> {
    const { signal } = ctx;
    const [color, normal, mw] = await Promise.all([
      loadTexture('moon-lroc', tier).catch(() => loadTexture('moon', tier)),
      loadTexture('moon-normal', tier).catch(() => null),
      loadTexture('milky-way', tier === '4k' ? '2k' : tier).catch(() => null),
    ]);
    if (signal.aborted) return;
    const mat = this.moon.material as THREE.MeshStandardMaterial;
    mat.map = color;
    mat.color.set(0xffffff);
    if (normal) {
      mat.normalMap = normal;
      mat.normalScale.set(1.4, 1.4);
    }
    mat.needsUpdate = true;
    if (mw) {
      this.milkyWay = new MilkyWay(mw, 0.45);
      this.scene.add(this.milkyWay.mesh);
    }
    // Earth in the sky, small and far, with the real phase
    const [day, night, clouds, specular] = await Promise.all([loadTexture('earth-day', '2k'), loadTexture('earth-night', '1k').catch(() => null), loadTexture('earth-clouds', '1k').catch(() => null), loadTexture('earth-specular', '1k').catch(() => null)]);
    if (signal.aborted) return;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(6.371, 96, 64), createEarthMaterial({ day, night, normal: null, specular, clouds }));
    this.earthAtmo = createAtmosphereShells('#6fb1ff', '#ff7a3d', 0.035);
    this.earthAtmo.inner.scale.multiplyScalar(6.371);
    this.earthAtmo.outer.scale.multiplyScalar(6.371);
    this.earth.add(this.earthAtmo.inner, this.earthAtmo.outer);
    this.scene.add(this.earth);
  }

  private buildMarkers(): void {
    this.markers.clear();
    const geo = new THREE.SphereGeometry(0.008, 12, 8);
    for (const s of this.sites) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: s.kind === 'crewed' ? 0xffd27a : 0x7fa8ff }));
      m.position.copy(latLon(s.lat, s.lon, R * 1.002));
      m.name = s.id;
      this.markers.add(m);
    }
    this.moon.add(this.markers);
  }

  /** Art-directed sun about 40 degrees east of a longitude, so relief reads and the terminator is nearby. */
  private static lightFor(lon: number): number {
    return (((lon - 40) / 360) % 1 + 1.5) % 1;
  }

  private flyPreset(preset: MoonPreset, immediate = false): void {
    const p = PRESETS[preset];
    const phi = ((90 - p.lat) * Math.PI) / 180;
    const theta = ((p.lon + 90) * Math.PI) / 180;
    const st = moonStore.getState();
    st.set({ earthVisible: preset !== 'far', sunlight: preset === 'near' && st.sunlight === null ? null : MoonExperience.lightFor(preset === 'terminator' ? p.lon + 55 : p.lon) });
    if (immediate) this.rig.importPose({ phi, theta, distance: p.distance, target: new THREE.Vector3() });
    else void this.rig.flyTo({ phi, theta, distance: p.distance }, 1.8);
  }

  private flySite(id: string): void {
    const s = this.sites.find((x) => x.id === id);
    if (!s) return;
    const phi = ((90 - s.lat) * Math.PI) / 180;
    const theta = ((s.lon + 90) * Math.PI) / 180;
    moonStore.getState().set({ earthVisible: Math.abs(s.lon) < 95, sunlight: MoonExperience.lightFor(s.lon) });
    void this.rig.flyTo({ phi, theta, distance: R * 1.9 }, 1.8);
  }

  private tourStep(): void {
    const stop = TOUR[this.tourIndex % TOUR.length]!;
    if (stop in PRESETS) moonStore.getState().set({ preset: stop as MoonPreset, site: null });
    else moonStore.getState().set({ site: stop });
  }

  update(dt: number, clock: ClockState): void {
    if (!this.ready) return;
    const s = moonStore.getState();
    const ms = clock.epochMs;
    // Moon orientation: IAU pole + spin (gives libration as the Earth-Moon geometry changes)
    const o = bodyOrientation('moon', ms);
    // We look at the Moon from Earth's side: keep the camera frame Earth-relative by rotating the Moon so its
    // sub-Earth point faces +X (theta = pi/2) unless the user has moved. Compute Earth direction in Moon frame.
    const rel = moonPositionKm(ms); // Earth -> Moon, scene frame km
    const toEarth = new THREE.Vector3(-rel[0], -rel[1], -rel[2]).normalize();
    if (o) {
      // rotate the whole scene so Earth sits along -Z of the camera's default frame: simpler to rotate the moon's
      // IAU orientation into a frame where toEarth = +X (sub-Earth point at lon ~0 faces the near-side preset).
      const q = new THREE.Quaternion().setFromUnitVectors(toEarth, new THREE.Vector3(1, 0, 0));
      this.moon.quaternion.copy(q).multiply(o.quaternion);
      // sun direction in the same rotated frame
      const e = planetPositionKm('earth', ms);
      const sunWorld = new THREE.Vector3(-(e[0] + rel[0]), -(e[1] + rel[1]), -(e[2] + rel[2])).normalize().applyQuaternion(q);
      if (s.sunlight !== null) {
        const ang = (s.sunlight - 0.5) * Math.PI * 2;
        sunWorld.set(Math.cos(ang), 0.15, -Math.sin(ang)).normalize();
      }
      this.sun.position.copy(sunWorld).multiplyScalar(100);
      if (this.earth) {
        const earthDir = new THREE.Vector3(1, 0, 0); // toEarth after q
        // staged composition: Earth at compressed distance so it is visible, real relative radius
        this.earth.position.copy(earthDir).multiplyScalar(R * 22).add(new THREE.Vector3(0, R * 4, 0));
        const eo = bodyOrientation('earth', ms);
        if (eo) this.earth.quaternion.copy(q).multiply(eo.quaternion);
        this.earth.visible = s.earthVisible;
        const em = this.earth.material as THREE.ShaderMaterial;
        em.uniforms.uSunDir!.value.copy(sunWorld);
        em.uniforms.uSunIntensity!.value = 2.2;
        this.earthAtmo?.setSun(sunWorld);
      }
    }
    this.rig.update(dt);
    // labels
    const entries: LabelEntry[] = this.sites.map((site) => {
      const p = latLon(site.lat, site.lon, R * 1.002).applyQuaternion(this.moon.quaternion);
      return { id: site.id, text: site.name, color: site.kind === 'crewed' ? '#ffd27a' : '#7fa8ff', priority: site.kind === 'crewed' ? 3 : 1, position: p, radius: 0.01, visible: true };
    });
    this.labels.update(entries, this.camera, { center: new THREE.Vector3(), radius: R }, s.site);
    if (s.tour) {
      this.tourTimer += dt;
      if (this.tourTimer > 9) {
        this.tourTimer = 0;
        this.tourIndex = (this.tourIndex + 1) % TOUR.length;
        this.tourStep();
      }
    }
    const c = this.ctx.renderer.canvas;
    c.dataset.preset = s.preset;
    c.dataset.site = s.site ?? '';
    c.dataset.lighting = s.sunlight === null ? 'real' : 'illustrative';
  }

  zoom(factor: number): void {
    if (!this.ready) return;
    this.rig.cancelFlight();
    void this.rig.flyTo({ distance: this.rig.pose.distance * factor }, 0.6);
  }

  override commands(): Command[] {
    const s = moonStore.getState();
    return [
      ...(['near', 'far', 'south', 'terminator'] as MoonPreset[]).map((p) => ({ id: `preset:${p}`, label: `Moon: ${p === 'near' ? 'near side' : p === 'far' ? 'far side' : p === 'south' ? 'south pole' : 'light & shadow'}`, group: 'Moon', run: () => s.set({ preset: p, site: null }) })),
      ...this.sites.map((site) => ({ id: `site:${site.id}`, label: `Visit ${site.name} (${site.date.slice(0, 4)})`, group: 'Landing sites', run: () => s.set({ site: site.id }) })),
      { id: 'tour', label: 'Play the lunar tour', group: 'Moon', run: () => s.set({ tour: true }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    (this.rig as CameraRig | undefined)?.dispose();
    (this.labels as Labels | undefined)?.dispose();
    this.stars.dispose();
    this.milkyWay?.dispose();
    this.earthAtmo?.dispose();
    super.unmount();
  }
}

/** Planetocentric lat/lon (deg, east positive) to a point on a sphere whose prime meridian is +X. */
export function latLon(lat: number, lon: number, r: number): THREE.Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
