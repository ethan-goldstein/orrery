import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { MilkyWay } from '@/engine/MilkyWay';
import { CameraRig } from '@/engine/CameraRig';
import { Labels, type LabelEntry } from '@/engine/Labels';
import { assetUrl, loadTexture } from '@/engine/Assets';
import { handoffFromPose, poseFromHandoff, type Handoff } from '@/engine/Journey';
import type { ClockState } from '@/astro/time';
import type { WorldState, WorldStore } from '@/store/world';
import { formatDistanceKm } from '@/engine/motion';
import { UNITS_PER_KM } from '@/astro/scale';

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

export interface WorldPreset {
  lat: number;
  lon: number;
  distance: number;
  /** art-directed sun offset in degrees of longitude from the preset (undefined = real sun) */
  light?: number;
}

export interface WorldConfig {
  id: string;
  radiusKm: number;
  /** scene units: 1 = 1000 km */
  radiusUnits: number;
  textures: { color: string; fallback?: string; normal?: string; normalScale?: number };
  sitesUrl: string;
  presets: Record<string, WorldPreset>;
  tour: string[];
  /** longitude offset for art-directed lighting, degrees east of the site */
  lightOffsetDeg: number;
  siteDistance: number;
  maxDistance: number;
}

/** Planetocentric lat/lon (deg, east positive) on a sphere whose prime meridian is +X. */
export function latLon(lat: number, lon: number, r: number): THREE.Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

/**
 * One world, up close: globe with a photographic map and relief, landing
 * sites with mission cards, presets, a guided tour, a sun dial, camera
 * handoff to and from the Solar System. Subclasses provide the orientation
 * for the date, the real sun direction and any companions in the sky.
 */
export abstract class WorldExperience extends Experience {
  protected stars = new Starfield();
  protected milkyWay: MilkyWay | null = null;
  protected rig!: CameraRig;
  protected labels!: Labels;
  protected globe!: THREE.Mesh;
  protected sun = new THREE.DirectionalLight(0xfff6e6, 3.0);
  protected markers = new THREE.Group();
  protected sites: Site[] = [];
  protected ready = false;
  protected unsub: (() => void)[] = [];
  protected lastEpochMs = Date.now();
  private tourTimer = 0;
  private tourIndex = 0;

  constructor(
    readonly config: WorldConfig,
    protected readonly store: WorldStore,
  ) {
    super();
  }

  /** Globe orientation for the date, plus the rotation from the shared frame into this page's frame. */
  protected abstract orientation(ms: number): { globe: THREE.Quaternion; frame: THREE.Quaternion };
  /** Real sun direction in this page's frame. */
  protected abstract realSun(ms: number, frame: THREE.Quaternion): THREE.Vector3;
  /** Companions in the sky (default none). */
  protected updateCompanions(_ms: number, _frame: THREE.Quaternion, _sun: THREE.Vector3, _state: WorldState): void {}
  /** Extra assets (default none). */
  protected async loadExtras(_ctx: ExperienceContext, _tier: '1k' | '2k' | '4k'): Promise<void> {}
  /** Per-frame hook after lighting (default none). */
  protected afterUpdate(_dt: number, _state: WorldState): void {}

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    const R = this.config.radiusUnits;
    this.camera.near = 0.01;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, this.sun, new THREE.AmbientLight(0x0b0d12, 0.35));
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(R, tier.sphereSegments, tier.sphereSegments / 2), new THREE.MeshStandardMaterial({ color: 0x8a8781, roughness: 1 }));
    this.globe.add(this.markers);
    this.scene.add(this.globe);
    const first = this.config.presets[this.store.getState().preset] ?? Object.values(this.config.presets)[0]!;
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: first.distance, phi: 1.48, theta: Math.PI / 2 });
    this.rig.limits = { minDistance: R * 1.08, maxDistance: this.config.maxDistance, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.rig.anchor = { center: new THREE.Vector3(), radius: R };
    this.rig.readout = (d) => `${formatDistanceKm((d - R) / UNITS_PER_KM)} up`;
    this.rig.element.addEventListener('pointerdown', () => this.store.getState().set({ tour: false }));
    this.labels = new Labels(ctx.stage);
    this.labels.onSelect = (id) => this.store.getState().set({ site: id, tour: false });
    this.unsub.push(
      this.store.subscribe((s, prev) => {
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
    this.flyPreset(this.store.getState().preset, true);
    // camera handoff from another world
    const h = ctx.handoff;
    if (h?.bodyId === this.config.id) {
      this.rig.limits.maxDistance = R * 40;
      this.rig.importPose({ ...poseFromHandoff(h, this.config.radiusKm, R, this.orientation(h.epochMs).frame), target: new THREE.Vector3() });
      this.acceptedHandoff = true;
      const p = this.config.presets[this.store.getState().preset]!;
      const dest = { phi: ((90 - p.lat) * Math.PI) / 180, theta: ((p.lon + 90) * Math.PI) / 180, distance: p.distance, target: new THREE.Vector3() };
      this.rig.setHome(dest);
      void this.rig.flyTo(dest).then(() => {
        this.rig.limits.maxDistance = this.config.maxDistance;
      });
    } else if (h) {
      this.arriveFrom(h, ctx);
    }
    void this.loadAssets(ctx, tier.textureTier);
    await Promise.all([
      this.stars.load(ctx.signal).catch(() => undefined),
      fetch(assetUrl(this.config.sitesUrl), { signal: ctx.signal })
        .then((r) => r.json() as Promise<{ sites: Site[] }>)
        .then((d) => {
          this.sites = d.sites;
          this.buildMarkers();
          const s = this.store.getState().site;
          if (s) this.flySite(s);
        })
        .catch(() => undefined),
    ]);
  }

  /** Arrival from a different world (default: none; the Moon overrides for the Earth flight). */
  protected arriveFrom(_h: Handoff, _ctx: ExperienceContext): void {}

  private async loadAssets(ctx: ExperienceContext, tier: '1k' | '2k' | '4k'): Promise<void> {
    const { signal } = ctx;
    const t = this.config.textures;
    const [color, normal, mw] = await Promise.all([
      loadTexture(t.color, tier).catch(() => (t.fallback ? loadTexture(t.fallback, tier) : Promise.reject(new Error('no map')))),
      t.normal ? loadTexture(t.normal, tier).catch(() => null) : Promise.resolve(null),
      loadTexture('milky-way', tier === '4k' ? '2k' : tier).catch(() => null),
    ]);
    if (signal.aborted) return;
    const mat = this.globe.material as THREE.MeshStandardMaterial;
    mat.map = color;
    mat.color.set(0xffffff);
    if (normal) {
      mat.normalMap = normal;
      mat.normalScale.set(t.normalScale ?? 1.4, t.normalScale ?? 1.4);
    }
    mat.needsUpdate = true;
    this.markPainted();
    if (mw) {
      this.milkyWay = new MilkyWay(mw, 0.45);
      this.scene.add(this.milkyWay.mesh);
    }
    await this.loadExtras(ctx, tier);
  }

  private buildMarkers(): void {
    this.markers.clear();
    const R = this.config.radiusUnits;
    const geo = new THREE.SphereGeometry(R * 0.0045, 12, 8);
    for (const s of this.sites) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: s.kind === 'crewed' ? 0xffd27a : 0x7fa8ff }));
      m.position.copy(latLon(s.lat, s.lon, R * 1.002));
      m.name = s.id;
      this.markers.add(m);
    }
  }

  /** Art-directed sun a little east of a longitude so relief reads. */
  protected lightFor(lon: number): number {
    return ((((lon - this.config.lightOffsetDeg) / 360) % 1) + 1.5) % 1;
  }

  protected flyPreset(preset: string, immediate = false): void {
    const p = this.config.presets[preset];
    if (!p) return;
    const phi = ((90 - p.lat) * Math.PI) / 180;
    const theta = ((p.lon + 90) * Math.PI) / 180;
    const st = this.store.getState();
    st.set({ sunlight: p.light === undefined ? null : this.lightFor(p.lon + p.light) });
    if (immediate) this.rig.importPose({ phi, theta, distance: p.distance, target: new THREE.Vector3() });
    else void this.rig.flyTo({ phi, theta, distance: p.distance, target: new THREE.Vector3() });
  }

  protected flySite(id: string): void {
    const s = this.sites.find((x) => x.id === id);
    if (!s) return;
    const phi = ((90 - s.lat) * Math.PI) / 180;
    const theta = ((s.lon + 90) * Math.PI) / 180;
    this.store.getState().set({ sunlight: this.lightFor(s.lon) });
    void this.rig.flyTo({ phi, theta, distance: this.config.siteDistance, target: new THREE.Vector3() });
  }

  private tourStep(): void {
    const stop = this.config.tour[this.tourIndex % this.config.tour.length]!;
    if (stop in this.config.presets) this.store.getState().set({ preset: stop, site: null });
    else this.store.getState().set({ site: stop });
  }

  update(dt: number, clock: ClockState): void {
    if (!this.ready) return;
    const s = this.store.getState();
    const ms = clock.epochMs;
    this.lastEpochMs = ms;
    const { globe, frame } = this.orientation(ms);
    this.globe.quaternion.copy(globe);
    let sunDir = this.realSun(ms, frame);
    if (s.sunlight !== null) {
      const ang = (s.sunlight - 0.5) * Math.PI * 2;
      sunDir = new THREE.Vector3(Math.cos(ang), 0.15, -Math.sin(ang)).normalize();
    }
    this.sun.position.copy(sunDir).multiplyScalar(100);
    this.updateCompanions(ms, frame, sunDir, s);
    this.rig.update(dt);
    const R = this.config.radiusUnits;
    const entries: LabelEntry[] = this.sites.map((site) => ({
      id: site.id,
      text: site.name,
      color: site.kind === 'crewed' ? '#ffd27a' : '#7fa8ff',
      priority: site.kind === 'crewed' ? 3 : 1,
      position: latLon(site.lat, site.lon, R * 1.002).applyQuaternion(this.globe.quaternion),
      radius: 0.01,
      visible: true,
    }));
    this.labels.update(entries, this.camera, { center: new THREE.Vector3(), radius: R }, s.site);
    if (s.tour) {
      this.tourTimer += dt;
      if (this.tourTimer > 9) {
        this.tourTimer = 0;
        this.tourIndex = (this.tourIndex + 1) % this.config.tour.length;
        this.tourStep();
      }
    }
    this.afterUpdate(dt, s);
    const c = this.ctx.renderer.canvas;
    c.dataset.preset = s.preset;
    c.dataset.site = s.site ?? '';
    c.dataset.lighting = s.sunlight === null ? 'real' : 'illustrative';
    c.dataset.dust = s.dust.toFixed(2);
  }

  override exportPose(): Handoff | null {
    if (!this.ready) return null;
    return handoffFromPose(this.config.id, this.config.id, this.rig.poseAbout(new THREE.Vector3()), this.config.radiusKm, this.config.radiusUnits, this.lastEpochMs, this.orientation(this.lastEpochMs).frame);
  }

  override commands(): Command[] {
    const s = this.store.getState();
    const name = this.config.id[0]!.toUpperCase() + this.config.id.slice(1);
    return [
      ...Object.keys(this.config.presets).map((p) => ({ id: `preset:${p}`, label: `${name}: ${p.replace(/-/g, ' ')}`, group: name, run: () => s.set({ preset: p, site: null }) })),
      ...this.sites.map((site) => ({ id: `site:${site.id}`, label: `Visit ${site.name} (${site.date.slice(0, 4)})`, group: 'Landing sites', run: () => s.set({ site: site.id }) })),
      { id: 'tour', label: `Play the ${name} tour`, group: name, run: () => s.set({ tour: true }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    (this.rig as CameraRig | undefined)?.dispose();
    (this.labels as Labels | undefined)?.dispose();
    this.stars.dispose();
    this.milkyWay?.dispose();
    super.unmount();
  }
}
