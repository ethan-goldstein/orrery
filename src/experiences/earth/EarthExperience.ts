import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { MilkyWay } from '@/engine/MilkyWay';
import { CameraRig } from '@/engine/CameraRig';
import { assetUrl, loadTexture } from '@/engine/Assets';
import { createHistoryEarthMaterial } from '@/engine/materials/HistoryEarthMaterial';
import { createCloudMaterial } from '@/engine/materials/EarthMaterial';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import type { ClockState } from '@/astro/time';
import { bodyOrientation } from '@/astro/rotation';
import { planetPositionKm } from '@/astro/ephemeris';
import { earthStore } from '@/store/earth';
import { ERAS, eraAt } from './eras';

interface FrameIndex {
  frames: { ma: number; file: string }[];
  width: number;
  height: number;
}

const EARTH_RADIUS = 6.371; // scene units (1000 km)

/**
 * Earth through 4.54 billion years. Present day uses the real sub-solar
 * point for the simulation date; the past is art-directed.
 */
export class EarthExperience extends Experience {
  readonly id = 'earth';
  private stars = new Starfield();
  private milkyWay: MilkyWay | null = null;
  private rig!: CameraRig;
  private globe!: THREE.Mesh;
  private material: THREE.ShaderMaterial | null = null;
  private clouds: THREE.Mesh | null = null;
  private atmosphere: ReturnType<typeof createAtmosphereShells> | null = null;
  private sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
  private index: FrameIndex | null = null;
  private frames = new Map<number, Promise<THREE.Texture>>();
  private resident: number[] = [];
  private loader = new THREE.TextureLoader();
  private ready = false;
  private spin = 0;
  private unsub: (() => void)[] = [];
  private playAccumulator = 0;
  private time = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    this.camera.near = 0.05;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, this.sun, new THREE.AmbientLight(0x101a2a, 0.5));
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());

    this.globe = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, tier.sphereSegments, tier.sphereSegments / 2), new THREE.MeshStandardMaterial({ color: 0x1d3a6a, roughness: 1 }));
    this.scene.add(this.globe);
    this.atmosphere = createAtmosphereShells('#6fb1ff', '#ff7a3d', 0.035);
    this.atmosphere.inner.scale.multiplyScalar(EARTH_RADIUS);
    this.atmosphere.outer.scale.multiplyScalar(EARTH_RADIUS);
    this.scene.add(this.atmosphere.inner, this.atmosphere.outer);

    this.rig = new CameraRig(this.camera, ctx.stage, { distance: EARTH_RADIUS * 3.1, phi: 1.25, theta: 0.6 });
    this.rig.limits = { minDistance: EARTH_RADIUS * 1.15, maxDistance: EARTH_RADIUS * 12, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.rig.element.addEventListener('pointerdown', () => earthStore.getState().set({ playing: false }));

    // scroll = time travel (the reference's signature interaction), wheel over UI still scrolls
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      e.preventDefault();
      const s = earthStore.getState();
      const delta = Math.max(-240, Math.min(240, e.deltaY));
      s.set({ ma: clampMa(s.ma + delta * 3.2), playing: false });
    };
    ctx.stage.addEventListener('wheel', onWheel, { passive: false });
    this.rig.zoomSpeed = 0; // wheel no longer zooms here; buttons do
    this.unsub.push(() => ctx.stage.removeEventListener('wheel', onWheel));

    this.unsub.push(
      earthStore.subscribe((s, prev) => {
        if (s.ma !== prev.ma) this.requestFrames(s.ma);
      }),
    );
    this.ready = true;
    void this.loadAssets(ctx, tier.textureTier);
    await this.stars.load(ctx.signal).catch(() => undefined);
  }

  private async loadAssets(ctx: ExperienceContext, tier: '1k' | '2k' | '4k'): Promise<void> {
    const { signal } = ctx;
    const [day, night, clouds, specular, mw] = await Promise.all([
      loadTexture('earth-day', tier),
      loadTexture('earth-night', tier).catch(() => null),
      loadTexture('earth-clouds', tier).catch(() => null),
      loadTexture('earth-specular', tier).catch(() => null),
      loadTexture('milky-way', tier === '4k' ? '2k' : tier).catch(() => null),
    ]);
    if (signal.aborted) return;
    this.material = createHistoryEarthMaterial({ day, night, clouds, specular });
    (this.globe.material as THREE.Material).dispose();
    this.globe.material = this.material;
    if (clouds) {
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.004, 96, 64), createCloudMaterial(clouds));
      this.clouds.renderOrder = 1;
      this.scene.add(this.clouds);
    }
    if (mw) {
      this.milkyWay = new MilkyWay(mw, 0.45);
      this.scene.add(this.milkyWay.mesh);
    }
    try {
      const res = await fetch(assetUrl('data/paleo/index.json'), { signal });
      if (res.ok) {
        this.index = (await res.json()) as FrameIndex;
        this.material.uniforms.uTexel!.value.set(1 / this.index.width, 1 / this.index.height);
        this.requestFrames(earthStore.getState().ma);
      }
    } catch {
      /* no frames: the shader falls back to photographic */
    }
  }

  private frame(ma: number): Promise<THREE.Texture> {
    let p = this.frames.get(ma);
    if (!p) {
      const entry = this.index!.frames.find((f) => f.ma === ma)!;
      p = this.loader.loadAsync(assetUrl(entry.file)).then((t) => {
        t.colorSpace = THREE.LinearSRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        t.wrapS = THREE.RepeatWrapping;
        return t;
      });
      this.frames.set(ma, p);
      this.resident.push(ma);
      // keep at most 10 frames on the GPU
      while (this.resident.length > 10) {
        const old = this.resident.shift()!;
        if (Math.abs(old - ma) > 12) {
          this.frames.get(old)?.then((t) => t.dispose());
          this.frames.delete(old);
        } else this.resident.push(old);
        if (this.resident.length <= 10) break;
      }
    }
    return p;
  }

  private bracket(ma: number): { a: number; b: number; mix: number } | null {
    if (!this.index) return null;
    const ages = this.index.frames.map((f) => f.ma);
    const max = ages[ages.length - 1]!;
    const m = Math.min(ma, max);
    let a = ages[0]!;
    let b = ages[0]!;
    for (let i = 0; i < ages.length - 1; i++) {
      if (m >= ages[i]! && m <= ages[i + 1]!) {
        a = ages[i]!;
        b = ages[i + 1]!;
        break;
      }
    }
    if (m >= max) a = b = max;
    const mix = a === b ? 0 : (m - a) / (b - a);
    return { a, b, mix };
  }

  private requestFrames(ma: number): void {
    const br = this.bracket(ma);
    if (!br || !this.material) return;
    const { a, b } = br;
    void Promise.all([this.frame(a), this.frame(b)]).then(([ta, tb]) => {
      const now = this.bracket(earthStore.getState().ma);
      if (!now || now.a !== a || now.b !== b || !this.material) return;
      this.material.uniforms.uFrameA!.value = ta;
      this.material.uniforms.uFrameB!.value = tb;
      this.material.uniforms.uHasFrames!.value = 1;
      earthStore.getState().set({ framesLoaded: this.frames.size });
    });
    // prefetch neighbours
    const ages = this.index!.frames.map((f) => f.ma);
    const i = ages.indexOf(b);
    for (const j of [i + 1, i - 2]) if (ages[j] !== undefined) void this.frame(ages[j]!);
  }

  update(dt: number, clock: ClockState): void {
    if (!this.ready) return;
    this.time += dt;
    const s = earthStore.getState();
    // story playback: constant slider speed, so every era gets equal time
    if (s.playing) {
      this.playAccumulator += dt * s.speed;
      const next = s.ma - dt * s.speed * 90; // ~50 s for the whole story at 1x
      if (next <= 0) s.set({ ma: 0, playing: false });
      else s.set({ ma: next });
    }
    const era = eraAt(s.ma);
    const br = this.bracket(s.ma);
    // orientation: real IAU pole + spin today; art-directed slow spin in the past
    const ms = clock.epochMs;
    const sunHour = s.sunHour ?? (s.ma < 0.5 ? null : 10.2);
    const o = bodyOrientation('earth', ms);
    if (o) this.globe.quaternion.copy(o.quaternion);
    if (s.rotate) this.spin += dt * 0.03;
    const spinQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sunHour === null ? 0 : this.spin);
    this.globe.quaternion.multiply(spinQ);
    if (this.clouds) this.clouds.quaternion.copy(this.globe.quaternion);
    // sun direction: real for the date, or art-directed hour around the equator
    // Today: the real sun for the simulation date. The past: art-directed light from behind the camera,
    // slightly to the side, so the reconstruction is always readable (labelled as illustrative in the UI).
    let sunDir: THREE.Vector3;
    if (sunHour === null) {
      const e = planetPositionKm('earth', ms);
      sunDir = new THREE.Vector3(-e[0], -e[1], -e[2]).normalize();
    } else {
      const ang = ((sunHour - 12) / 24) * Math.PI * 2;
      sunDir = new THREE.Vector3(Math.sin(ang), 0.3, Math.cos(ang)).normalize();
      // keep the sun in the camera's frame of reference so the slider feels like a dial
      const camTheta = this.rig.pose.theta;
      sunDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), camTheta);
    }
    if (s.light === 'night') sunDir.negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
    this.sun.position.copy(sunDir).multiplyScalar(100);
    this.atmosphere?.setSun(sunDir);
    if (this.material) {
      const u = this.material.uniforms;
      u.uSunDir!.value.copy(sunDir);
      u.uTime!.value = this.time;
      if (br) {
        u.uFrameMix!.value = br.mix;
      }
      const photo = s.ma < 0.5 ? 1 : s.ma < 6 ? 1 - s.ma / 6 : 0;
      u.uPhoto!.value = s.compare ? 0 : photo;
      u.uCompare!.value = s.compare ? 1 : 0;
      // art-directed knobs interpolate between neighbouring eras
      const { heat, ice, sea, cloud } = blendEraKnobs(s.ma);
      u.uHeat!.value = heat;
      u.uIce!.value = ice;
      u.uSeaLevel!.value = sea;
      u.uCloudOpacity!.value = s.clouds ? cloud : 0;
      u.uCloudShift!.value = (this.time * 0.0015) % 1;
      u.uBlueHour!.value = s.light === 'blue' ? 1 : 0;
      u.uNightMode!.value = s.light === 'night' ? 1 : 0;
      u.uSunIntensity!.value = s.light === 'blue' ? 1.5 : 2.4;
      if (s.ma > 540) u.uHasFrames!.value = this.frames.size > 0 ? 1 : 0;
    }
    if (this.clouds) {
      const cm = this.clouds.material as THREE.ShaderMaterial;
      cm.uniforms.uSunDir!.value.copy(sunDir);
      cm.uniforms.uShift!.value = (this.time * 0.0015) % 1;
      cm.uniforms.uOpacity!.value = s.clouds ? blendEraKnobs(s.ma).cloud : 0;
      this.clouds.visible = s.clouds;
    }
    this.rig.update(dt);
    const c = this.ctx.renderer.canvas;
    c.dataset.ma = s.ma.toFixed(1);
    c.dataset.era = era.id;
    c.dataset.frames = String(this.frames.size);
    c.dataset.lighting = sunHour === null ? 'real' : 'illustrative';
  }

  flyToEra(lat: number, lon: number): void {
    if (!this.ready) return;
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lon + 90) * Math.PI) / 180;
    void this.rig.flyTo({ phi, theta }, 1.6);
  }

  zoom(factor: number): void {
    if (!this.ready) return;
    this.rig.cancelFlight();
    void this.rig.flyTo({ distance: this.rig.pose.distance * factor }, 0.6);
  }

  override commands(): Command[] {
    const s = earthStore.getState();
    return [
      ...ERAS.map((e) => ({ id: `era:${e.id}`, label: `Travel to ${e.title} (${e.fact} ${e.factLabel})`, group: 'Eras', run: () => s.set({ ma: e.ma, playing: false }) })),
      { id: 'play', label: 'Play Earth’s history', group: 'Earth', run: () => s.set({ ma: 4540, playing: true }) },
      { id: 'compare', label: 'Compare with today', group: 'Earth', run: () => s.set({ compare: !earthStore.getState().compare }) },
      { id: 'light:natural', label: 'Lighting: natural', group: 'Earth', run: () => s.set({ light: 'natural' }) },
      { id: 'light:night', label: 'Lighting: after dark', group: 'Earth', run: () => s.set({ light: 'night' }) },
      { id: 'light:blue', label: 'Lighting: blue hour', group: 'Earth', run: () => s.set({ light: 'blue' }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    (this.rig as CameraRig | undefined)?.dispose();
    this.stars.dispose();
    this.milkyWay?.dispose();
    this.atmosphere?.dispose();
    for (const p of this.frames.values()) p.then((t) => t.dispose()).catch(() => undefined);
    this.frames.clear();
    super.unmount();
  }
}

export function clampMa(ma: number): number {
  return Math.min(4540, Math.max(0, ma));
}

function blendEraKnobs(ma: number): { heat: number; ice: number; sea: number; cloud: number } {
  const eras = [...ERAS].sort((a, b) => a.ma - b.ma);
  let lo = eras[0]!;
  let hi = eras[eras.length - 1]!;
  for (let i = 0; i < eras.length - 1; i++) {
    if (ma >= eras[i]!.ma && ma <= eras[i + 1]!.ma) {
      lo = eras[i]!;
      hi = eras[i + 1]!;
      break;
    }
  }
  const t = lo === hi ? 0 : (ma - lo.ma) / (hi.ma - lo.ma);
  const k = t * t * (3 - 2 * t);
  return {
    heat: lo.heat + (hi.heat - lo.heat) * k,
    ice: lo.ice + (hi.ice - lo.ice) * k,
    sea: lo.seaLevel + (hi.seaLevel - lo.seaLevel) * k,
    cloud: lo.cloud + (hi.cloud - lo.cloud) * k,
  };
}
