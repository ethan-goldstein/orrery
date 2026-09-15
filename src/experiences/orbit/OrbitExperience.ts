import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { applyLogDepth } from '@/engine/materials/logDepth';
import { CameraRig } from '@/engine/CameraRig';
import { OrbitLine } from '@/engine/OrbitLine';
import { Labels } from '@/engine/Labels';
import { assetUrl, loadTexture } from '@/engine/Assets';
import { createEarthMaterial, createCloudMaterial } from '@/engine/materials/EarthMaterial';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import type { ClockState } from '@/astro/time';
import { planetPositionKm } from '@/astro/ephemeris';
import { OBLIQUITY_J2000_DEG } from '@/astro/frames';
import { orbitStore, type OrbitGroup } from '@/store/orbit';

interface Obj { n: string; id: number; t: number; y: number; o: string; e: string; mm: number; ec: number; in: number; ra: number; ap: number; ma: number; bs: number; md: number; rev: number; els: number }

const R = 6.371;
const ISS = 25544;
const TYPE_COLORS: [number, number, number][] = [
  [1.0, 0.82, 0.45], // payload
  [0.98, 0.5, 0.3], // rocket body
  [0.55, 0.6, 0.75], // debris
  [0.6, 0.8, 1.0], // unknown / analyst
];
const GROUP_ALT: Record<OrbitGroup, [number, number]> = { leo: [0, 2000], meo: [2000, 34_000], geo: [34_000, 38_000], all: [0, Infinity] };

/**
 * Tens of thousands of tracked objects around a live Earth. SGP4 runs in a
 * worker; the main thread extrapolates between worker updates with the
 * velocities it returns.
 */
export class OrbitExperience extends Experience {
  readonly id = 'orbit';
  private stars = new Starfield();
  private rig!: CameraRig;
  private labels!: Labels;
  private earth!: THREE.Mesh;
  private clouds: THREE.Mesh | null = null;
  private atmo: ReturnType<typeof createAtmosphereShells> | null = null;
  private sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  private worker: Worker | null = null;
  private objects: Obj[] = [];
  private index = new Map<number, number>(); // norad -> row in worker order
  private ids: number[] = [];
  private state: Float32Array | null = null; // latest worker buffer (x,y,z,vx,vy,vz)
  private stateMs = 0;
  private busy = false;
  private points!: THREE.Points;
  private positions!: Float32Array;
  private colors!: Float32Array;
  private sizes!: Float32Array;
  private path = new OrbitLine('#ffd27a', 0.8, 1.5);
  private ready = false;
  private unsub: (() => void)[] = [];
  private lastVisibleCount = -1;
  private followVec = new THREE.Vector3();
  private lastWall = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    this.camera.near = 0.05;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, this.sun, new THREE.AmbientLight(0x101a2a, 0.5), this.path.line);
    this.path.line.visible = false;
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, tier.sphereSegments, tier.sphereSegments / 2), new THREE.MeshStandardMaterial({ color: 0x1d3a6a, roughness: 1 }));
    this.scene.add(this.earth);
    this.atmo = createAtmosphereShells('#6fb1ff', '#ff7a3d', 0.035);
    this.atmo.inner.scale.multiplyScalar(R);
    this.atmo.outer.scale.multiplyScalar(R);
    this.scene.add(this.atmo.inner, this.atmo.outer);
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: R * 3.6, phi: 1.2, theta: 0.5 });
    this.rig.limits = { minDistance: R * 1.02, maxDistance: R * 16, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.rig.element.addEventListener('pointerdown', () => {
      if (orbitStore.getState().follow) orbitStore.getState().set({ follow: false });
    });
    this.labels = new Labels(ctx.stage);
    this.labels.onSelect = (id) => orbitStore.getState().set({ selected: Number(id) });
    // picking
    const down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => ((down.x = e.clientX), (down.y = e.clientY));
    const onUp = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      this.pick(e.clientX, e.clientY);
    };
    ctx.stage.addEventListener('pointerdown', onDown);
    ctx.stage.addEventListener('pointerup', onUp);
    this.unsub.push(() => {
      ctx.stage.removeEventListener('pointerdown', onDown);
      ctx.stage.removeEventListener('pointerup', onUp);
    });
    this.unsub.push(
      orbitStore.subscribe((s, prev) => {
        if (s.selected !== prev.selected) this.onSelect(s.selected);
        if (s.group !== prev.group) this.frameGroup(s.group);
      }),
    );
    this.ready = true;
    void this.loadEarth(ctx, tier.textureTier);
    await Promise.all([this.stars.load(ctx.signal).catch(() => undefined), this.loadObjects(ctx)]);
  }

  private async loadEarth(ctx: ExperienceContext, tier: '1k' | '2k' | '4k'): Promise<void> {
    const [day, night, normal, specular, clouds] = await Promise.all([loadTexture('earth-day', tier), loadTexture('earth-night', tier).catch(() => null), loadTexture('earth-normal', tier).catch(() => null), loadTexture('earth-specular', tier).catch(() => null), loadTexture('earth-clouds', tier === '4k' ? '2k' : tier).catch(() => null)]);
    if (ctx.signal.aborted) return;
    (this.earth.material as THREE.Material).dispose();
    this.earth.material = createEarthMaterial({ day, night, normal, specular, clouds });
    if (clouds) {
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 96, 64), createCloudMaterial(clouds));
      this.clouds.renderOrder = 1;
      this.scene.add(this.clouds);
    }
  }

  private async loadObjects(ctx: ExperienceContext): Promise<void> {
    const res = await fetch(assetUrl('data/orbit/gp.json'), { signal: ctx.signal });
    if (!res.ok) throw new Error(`gp.json ${res.status}`);
    const data = (await res.json()) as { objects: Obj[]; snapshot: string };
    if (ctx.signal.aborted) return;
    const cap = ctx.renderer.tier.satelliteCap;
    // keep payloads first so a capped tier still shows the interesting objects
    this.objects = [...data.objects].sort((a, b) => a.t - b.t).slice(0, cap);
    orbitStore.getState().set({ totalCount: this.objects.length, snapshot: data.snapshot });
    this.ctx.renderer.canvas.dataset.snapshot = data.snapshot;
    this.worker = new Worker(new URL('./sgp4.worker.ts', import.meta.url), { type: 'module' });
    await new Promise<void>((resolve) => {
      this.worker!.onmessage = (ev: MessageEvent<{ type: string; count?: number; ids?: number[]; buffer?: Float32Array; ms?: number }>) => {
        const m = ev.data;
        if (m.type === 'loaded') {
          this.ids = m.ids!;
          this.index = new Map(this.ids.map((id, i) => [id, i]));
          this.buildPoints();
          resolve();
        } else if (m.type === 'positions') {
          this.spare = this.state;
          this.state = m.buffer!;
          this.stateMs = m.ms!;
          this.lastGmst = (m as { gmst?: number }).gmst ?? null;
          this.busy = false;
        }
      };
      this.worker!.postMessage({ type: 'load', objects: this.objects });
    });
    if (orbitStore.getState().selected) this.onSelect(orbitStore.getState().selected);
  }

  private buildPoints(): void {
    const n = this.ids.length;
    this.positions = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    const byId = new Map(this.objects.map((o) => [o.id, o]));
    this.ids.forEach((id, i) => {
      const o = byId.get(id)!;
      this.colors.set(TYPE_COLORS[Math.min(3, o.t)]!, i * 3);
      this.sizes[i] = id === ISS ? 9 : o.t === 0 ? 2.6 : 1.8;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: this.ctx.renderer.gl.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute float size; attribute vec3 color; varying vec3 vColor; varying float vSize; uniform float uPixelRatio;
        void main() {
          vColor = color; vSize = size;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.5, size * uPixelRatio * (30.0 / -mv.z) + 1.2);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vSize;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.35, d);
          gl_FragColor = vec4(vColor * (0.8 + 0.6 * a), a * 0.95);
        }`,
      transparent: true,
      depthWrite: false,
    });
    applyLogDepth(mat);
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  private altitudeKm(i: number): number {
    if (!this.state) return NaN;
    const o = i * 6;
    return Math.hypot(this.state[o]!, this.state[o + 1]!, this.state[o + 2]!) * 1000 - 6371;
  }

  private visibleFilter(i: number): boolean {
    const s = orbitStore.getState();
    const obj = this.objects[i];
    if (!obj) return false;
    if (!s.debris && obj.t >= 1) return obj.id === s.selected;
    if (obj.y > s.year && obj.y !== 0) return obj.id === s.selected;
    const [lo, hi] = GROUP_ALT[s.group];
    const alt = this.altitudeKm(i);
    if (!Number.isFinite(alt)) return false;
    return (alt >= lo && alt < hi) || obj.id === s.selected;
  }

  private onSelect(id: number | null): void {
    const s = orbitStore.getState();
    if (id === null || !this.index.has(id)) {
      this.path.line.visible = false;
      s.set({ selectedInfo: null, follow: false });
      return;
    }
    const obj = this.objects[this.index.get(id)!]!;
    s.set({ selectedInfo: { name: obj.n, id: obj.id, type: ['payload', 'rocket body', 'debris', 'unknown'][obj.t]!, owner: obj.o, launch: obj.y, altKm: 0, speedKmS: 0, periodMin: 1440 / obj.mm, incl: obj.in } });
    this.rebuildPath(id);
  }

  private rebuildPath(id: number): void {
    // one orbit sampled from the two-body elements is close enough for a guide
    const obj = this.objects[this.index.get(id)!]!;
    const mu = 398_600.4418;
    const n = (obj.mm * 2 * Math.PI) / 86400; // rad/s
    const a = Math.cbrt(mu / (n * n));
    const e = obj.ec;
    const inc = (obj.in * Math.PI) / 180;
    const raan = (obj.ra * Math.PI) / 180;
    const argp = (obj.ap * Math.PI) / 180;
    const pts: number[] = [];
    for (let k = 0; k <= 180; k++) {
      const E = (k / 180) * Math.PI * 2;
      const xp = a * (Math.cos(E) - e);
      const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const [cO, sO, ci, si, cw, sw] = [Math.cos(raan), Math.sin(raan), Math.cos(inc), Math.sin(inc), Math.cos(argp), Math.sin(argp)];
      const x = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
      const y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
      const z = sw * si * xp + cw * si * yp;
      pts.push(x * 1e-3, z * 1e-3, -y * 1e-3);
    }
    this.path.setPoints(pts);
    this.path.line.visible = orbitStore.getState().paths;
  }

  private frameGroup(group: OrbitGroup): void {
    const d = group === 'leo' ? R * 3.4 : group === 'meo' ? R * 8 : group === 'geo' ? R * 12 : R * 13;
    void this.rig.flyTo({ distance: d }, 1.6);
  }

  private pick(clientX: number, clientY: number): void {
    if (!this.state) return;
    const rect = this.ctx.stage.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const v = new THREE.Vector3();
    let best: { i: number; d: number } | null = null;
    for (let i = 0; i < this.ids.length; i++) {
      if (!this.visibleFilter(i)) continue;
      v.set(this.positions[i * 3]!, this.positions[i * 3 + 1]!, this.positions[i * 3 + 2]!);
      if (!Number.isFinite(v.x)) continue;
      // occluded by Earth?
      const toCam = this.camera.position.clone().sub(v);
      const t = -v.dot(toCam) / toCam.lengthSq();
      if (t > 0 && t < 1 && v.clone().addScaledVector(toCam, t).length() < R) continue;
      v.project(this.camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(px - x, py - y);
      if (d < 12 && (!best || d < best.d)) best = { i, d };
    }
    orbitStore.getState().set({ selected: best ? this.ids[best.i]! : null });
  }

  update(dt: number, clock: ClockState): void {
    if (!this.ready) return;
    const s = orbitStore.getState();
    const ms = clock.epochMs;
    const wall = performance.now();
    const realDt = this.lastWall ? Math.min(1, (wall - this.lastWall) / 1000) : dt;
    this.lastWall = wall;
    if (s.playingTimeline) {
      const next = s.year + realDt * 3;
      if (next >= new Date().getUTCFullYear()) s.set({ year: new Date().getUTCFullYear(), playingTimeline: false });
      else s.set({ year: next });
    }
    // Earth orientation: rotate by GMST about the celestial pole; the scene is ECI with +Y north.
    // Convert the ecliptic-frame sun direction into this equatorial scene frame.
    const e = planetPositionKm('earth', ms);
    const sunEcl = new THREE.Vector3(-e[0], -e[1], -e[2]).normalize(); // scene(ecl): (x, z_ecl, -y_ecl)
    // ecl -> eqj: rotate about x by +obliquity. scene(ecl) = (x, z, -y) so y_ecl = -sz, z_ecl = sy.
    const eps = (OBLIQUITY_J2000_DEG * Math.PI) / 180;
    const xe = sunEcl.x;
    const ye = -sunEcl.z;
    const ze = sunEcl.y;
    const yq = Math.cos(eps) * ye - Math.sin(eps) * ze;
    const zq = Math.sin(eps) * ye + Math.cos(eps) * ze;
    const sunDir = new THREE.Vector3(xe, zq, -yq).normalize(); // eqj -> scene(eqj) = (x, z, -y)
    this.sun.position.copy(sunDir).multiplyScalar(200);
    this.atmo?.setSun(sunDir);
    const em = this.earth.material as THREE.ShaderMaterial;
    if (em.uniforms?.uSunDir) {
      em.uniforms.uSunDir.value.copy(sunDir);
      em.uniforms.uCloudShift!.value = ((ms / 86_400_000) * 0.02) % 1;
    }
    if (this.clouds) {
      const cm = this.clouds.material as THREE.ShaderMaterial;
      cm.uniforms.uSunDir!.value.copy(sunDir);
      cm.uniforms.uShift!.value = ((ms / 86_400_000) * 0.02) % 1;
    }
    // GMST from the worker's last reply; before that, estimate it
    const gmst = this.lastGmst ?? gmstApprox(ms);
    this.earth.rotation.set(0, gmst, 0);
    if (this.clouds) this.clouds.rotation.set(0, gmst + 0.02, 0);

    // worker cadence
    if (this.worker && this.ids.length && !this.busy) {
      this.busy = true;
      this.worker.postMessage({ type: 'propagate', ms, buffer: this.spare }, this.spare ? [this.spare.buffer] : []);
      this.spare = null;
    }
    if (this.state && this.points) {
      const st = this.state;
      const simDt = Math.min((ms - this.stateMs) / 1000, 120); // seconds since the worker's epoch
      let visible = 0;
      for (let i = 0; i < this.ids.length; i++) {
        const o = i * 6;
        const show = this.visibleFilter(i);
        if (!show || !Number.isFinite(st[o]!)) {
          this.positions[i * 3] = NaN;
          continue;
        }
        visible++;
        this.positions[i * 3] = st[o]! + st[o + 3]! * simDt;
        this.positions[i * 3 + 1] = st[o + 1]! + st[o + 4]! * simDt;
        this.positions[i * 3 + 2] = st[o + 2]! + st[o + 5]! * simDt;
      }
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      if (visible !== this.lastVisibleCount) {
        this.lastVisibleCount = visible;
        s.set({ visibleCount: visible });
      }
      // selection: follow + info
      if (s.selected !== null && this.index.has(s.selected)) {
        const i = this.index.get(s.selected)!;
        this.followVec.set(this.positions[i * 3]!, this.positions[i * 3 + 1]!, this.positions[i * 3 + 2]!);
        if (Number.isFinite(this.followVec.x)) {
          const alt = this.followVec.length() * 1000 - 6371;
          const speed = Math.hypot(st[i * 6 + 3]!, st[i * 6 + 4]!, st[i * 6 + 5]!) * 1000;
          if (s.selectedInfo && Math.abs(s.selectedInfo.altKm - alt) > 1) s.set({ selectedInfo: { ...s.selectedInfo, altKm: alt, speedKmS: speed } });
          if (s.follow) {
            this.rig.pose.target.lerp(this.followVec, 1 - Math.exp(-dt * 6));
            this.rig.limits.minDistance = 0.05;
          } else if (!this.rig.flying) {
            this.rig.pose.target.lerp(new THREE.Vector3(), 1 - Math.exp(-dt * 4));
            this.rig.limits.minDistance = R * 1.02;
          }
          this.labels.update([{ id: String(s.selected), text: s.selectedInfo?.name ?? String(s.selected), color: '#ffd27a', priority: 5, position: this.followVec, radius: 0.02, visible: true }], this.camera, { center: new THREE.Vector3(), radius: R }, String(s.selected));
        }
      } else {
        this.labels.update([], this.camera, null, null);
        if (!this.rig.flying) this.rig.pose.target.lerp(new THREE.Vector3(), 1 - Math.exp(-dt * 4));
      }
      this.path.line.visible = s.paths && s.selected !== null && this.index.has(s.selected);
    }
    this.rig.update(dt);
    const c = this.ctx.renderer.canvas;
    c.dataset.group = s.group;
    c.dataset.visible = String(s.visibleCount);
    c.dataset.selected = s.selected === null ? '' : String(s.selected);
    c.dataset.follow = s.follow ? 'true' : 'false';
  }

  private lastGmst: number | null = null;
  private spare: Float32Array | null = null;

  zoom(factor: number): void {
    if (!this.ready) return;
    this.rig.cancelFlight();
    void this.rig.flyTo({ distance: this.rig.pose.distance * factor }, 0.6);
  }

  search(query: string, limit = 12): { id: number; name: string; type: number; launch: number }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { id: number; name: string; type: number; launch: number }[] = [];
    for (const o of this.objects) {
      if (o.n.toLowerCase().includes(q) || String(o.id) === q) {
        out.push({ id: o.id, name: o.n, type: o.t, launch: o.y });
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  override commands(): Command[] {
    const s = orbitStore.getState();
    return [
      { id: 'iss', label: 'Find and follow the International Space Station', group: 'Orbit', keywords: ['ISS', 'station'], run: () => s.set({ selected: ISS, follow: true, group: 'leo' }) },
      { id: 'group:leo', label: 'Orbit: near Earth (LEO)', group: 'Orbit', run: () => s.set({ group: 'leo' }) },
      { id: 'group:meo', label: 'Orbit: middle orbit (GPS, Galileo)', group: 'Orbit', run: () => s.set({ group: 'meo' }) },
      { id: 'group:geo', label: 'Orbit: geosynchronous', group: 'Orbit', run: () => s.set({ group: 'geo' }) },
      { id: 'group:all', label: 'Orbit: everything', group: 'Orbit', run: () => s.set({ group: 'all' }) },
      { id: 'debris', label: 'Toggle rocket bodies and debris', group: 'Orbit', run: () => s.set({ debris: !orbitStore.getState().debris }) },
      { id: 'space-age', label: 'Play the space age (1957 to today)', group: 'Orbit', run: () => s.set({ year: 1957, playingTimeline: true }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    this.worker?.terminate();
    this.worker = null;
    (this.rig as CameraRig | undefined)?.dispose();
    (this.labels as Labels | undefined)?.dispose();
    this.stars.dispose();
    this.atmo?.dispose();
    this.path.dispose();
    super.unmount();
  }
}

/** Greenwich mean sidereal time, radians (IAU 1982, good to a fraction of a second). */
export function gmstApprox(ms: number): number {
  const jd = ms / 86_400_000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
  g = ((g % 360) + 360) % 360;
  return (g * Math.PI) / 180;
}
