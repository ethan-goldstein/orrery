import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { applyLogDepth } from '@/engine/materials/logDepth';
import { CameraRig } from '@/engine/CameraRig';
import { assetUrl, loadTexture } from '@/engine/Assets';
import type { ClockState } from '@/astro/time';
import { quakeStore, type QuakePreset } from '@/store/quakes';
import { latLon } from '@/experiences/moon/MoonExperience';

type Row = [number, number, number, number, number, string, string];
const R = 6.371;

const PRESETS: Record<QuakePreset, { lat: number; lon: number; distance: number; filter: (r: Row) => boolean }> = {
  all: { lat: 15, lon: -150, distance: R * 3.4, filter: () => true },
  pacific: { lat: 10, lon: -170, distance: R * 3.0, filter: (r) => (r[2] > 100 || r[2] < -60) && r[1] > -60 && r[1] < 65 },
  japan2011: { lat: 38, lon: 142, distance: R * 1.5, filter: (r) => r[0] >= 1_299_800_000 && r[0] <= 1_302_000_000 && r[1] > 30 && r[1] < 45 && r[2] > 135 && r[2] < 150 },
  deep: { lat: -15, lon: 175, distance: R * 3.0, filter: (r) => r[3] >= 300 },
};

const depthColor = (d: number): [number, number, number] => (d < 70 ? [1.0, 0.82, 0.45] : d < 300 ? [1.0, 0.42, 0.25] : [0.5, 0.55, 1.0]);

/**
 * Every M6+ earthquake since 2000 as lights on a globe: size by magnitude,
 * colour by depth, revealed in time order, with a ripple on fresh events.
 */
export class QuakesExperience extends Experience {
  readonly id = 'quakes';
  private stars = new Starfield();
  private rig!: CameraRig;
  private globe!: THREE.Mesh;
  private rows: Row[] = [];
  private points!: THREE.Points;
  private sizes!: Float32Array;
  private base!: Float32Array;
  private alphas!: Float32Array;
  private ready = false;
  private unsub: (() => void)[] = [];
  private time = 0;
  private lastWall = 0;
  private selectedMarker = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    this.camera.near = 0.05;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, new THREE.AmbientLight(0x9fb0cc, 2.2));
    const sun = new THREE.DirectionalLight(0xfff6e6, 1.4);
    sun.position.set(-40, 30, 60);
    this.scene.add(sun);
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 1 }));
    this.scene.add(this.globe);
    this.selectedMarker.visible = false;
    this.scene.add(this.selectedMarker);
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: R * 3.4, phi: 1.3, theta: 0.4 });
    this.rig.limits = { minDistance: R * 1.15, maxDistance: R * 10, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.unsub.push(
      quakeStore.subscribe((s, prev) => {
        if (s.preset !== prev.preset) this.applyPreset(s.preset);
        if (s.selected !== prev.selected) this.select(s.selected);
      }),
    );
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
    this.ready = true;
    void loadTexture('earth-day', ctx.renderer.tier.textureTier === '1k' ? '1k' : '2k').then((t) => {
      if (ctx.signal.aborted) return;
      const m = this.globe.material as THREE.MeshStandardMaterial;
      m.map = t;
      m.color.set(0xc4ccd8); // muted so the lights carry the story
      m.needsUpdate = true;
    });
    await Promise.all([
      this.stars.load(ctx.signal).catch(() => undefined),
      fetch(assetUrl('data/quakes/m6.json'), { signal: ctx.signal })
        .then((r) => r.json() as Promise<{ rows: Row[]; start: string; end: string }>)
        .then((d) => {
          this.rows = d.rows;
          this.build();
          const start = this.rows[0]?.[0] ?? 946_684_800;
          const end = this.rows[this.rows.length - 1]?.[0] ?? Math.floor(Date.now() / 1000);
          quakeStore.getState().set({ totalCount: this.rows.length, range: { start, end }, throughSeconds: Math.min(quakeStore.getState().throughSeconds, end) });
          this.applyPreset(quakeStore.getState().preset, true);
          const sel = quakeStore.getState().selected;
          if (sel) this.select(sel);
        }),
    ]);
  }

  private build(): void {
    const n = this.rows.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    this.base = new Float32Array(n);
    this.alphas = new Float32Array(n);
    this.rows.forEach((r, i) => {
      const p = latLon(r[1], r[2], R * 1.003);
      positions.set([p.x, p.y, p.z], i * 3);
      colors.set(depthColor(r[3]), i * 3);
      this.base[i] = 2.5 + Math.pow(r[4] - 5.8, 2.2) * 3.2;
      this.sizes[i] = this.base[i]!;
      this.alphas[i] = 1;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: this.ctx.renderer.gl.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha; uniform float uPixelRatio;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (18.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          if (vAlpha <= 0.001) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float core = smoothstep(1.0, 0.2, d);
          float halo = exp(-d * d * 4.0) * 0.5;
          gl_FragColor = vec4(vColor * (core + halo) * 1.6, (core + halo) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    applyLogDepth(mat);
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  private applyPreset(preset: QuakePreset, immediate = false): void {
    const p = PRESETS[preset];
    const phi = ((90 - p.lat) * Math.PI) / 180;
    const theta = ((p.lon + 90) * Math.PI) / 180;
    if (immediate) this.rig.importPose({ phi, theta, distance: p.distance, target: new THREE.Vector3() });
    else void this.rig.flyTo({ phi, theta, distance: p.distance }, 1.8);
    if (preset === 'japan2011') quakeStore.getState().set({ throughSeconds: 1_302_000_000 });
    else if (quakeStore.getState().throughSeconds < quakeStore.getState().range.end - 86400 && !quakeStore.getState().playing && preset !== 'all') quakeStore.getState().set({ throughSeconds: quakeStore.getState().range.end });
  }

  private select(id: string | null): void {
    const i = this.rows.findIndex((r) => r[6] === id);
    if (i < 0) {
      this.selectedMarker.visible = false;
      quakeStore.getState().set({ selectedInfo: null });
      return;
    }
    const r = this.rows[i]!;
    const p = latLon(r[1], r[2], R * 1.01);
    this.selectedMarker.position.copy(p);
    this.selectedMarker.lookAt(p.clone().multiplyScalar(2));
    this.selectedMarker.visible = true;
    quakeStore.getState().set({ selectedInfo: { id: r[6], place: r[5], mag: r[4], depthKm: r[3], time: r[0], lat: r[1], lon: r[2] } });
    const phi = ((90 - r[1]) * Math.PI) / 180;
    const theta = ((r[2] + 90) * Math.PI) / 180;
    void this.rig.flyTo({ phi, theta, distance: Math.min(this.rig.pose.distance, R * 2.2) }, 1.4);
  }

  private pick(clientX: number, clientY: number): void {
    const rect = this.ctx.stage.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best: { i: number; d: number } | null = null;
    const v = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    for (let i = 0; i < this.rows.length; i++) {
      if (this.alphas[i]! <= 0) continue;
      v.fromBufferAttribute(this.points.geometry.attributes.position as THREE.BufferAttribute, i);
      if (v.dot(this.camera.position) < R * R * 0.9) continue; // back side
      v.project(this.camera);
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(px - x, py - y);
      if (d < 14 && (!best || d < best.d)) best = { i, d };
    }
    quakeStore.getState().set({ selected: best ? this.rows[best.i]![6] : null });
  }

  update(dt: number, _clock: ClockState): void {
    if (!this.ready) return;
    this.time += dt;
    const s = quakeStore.getState();
    const wall = performance.now();
    const realDt = this.lastWall ? Math.min(1, (wall - this.lastWall) / 1000) : dt;
    this.lastWall = wall;
    if (s.playing) {
      const next = s.throughSeconds + realDt * 86400 * 120; // ~120 days per second
      if (next >= s.range.end) s.set({ throughSeconds: s.range.end, playing: false });
      else s.set({ throughSeconds: next });
    }
    if (this.points) {
      const filter = PRESETS[s.preset].filter;
      let visible = 0;
      for (let i = 0; i < this.rows.length; i++) {
        const r = this.rows[i]!;
        const show = filter(r) && r[0] <= s.throughSeconds;
        const age = s.throughSeconds - r[0];
        const fresh = s.playing && age >= 0 && age < 86400 * 45 ? 1 - age / (86400 * 45) : 0;
        this.alphas[i] = show ? 0.55 + 0.45 * fresh : 0;
        this.sizes[i] = this.base[i]! * (1 + fresh * 2.5) * (s.selected === r[6] ? 1.6 : 1);
        if (show) visible++;
      }
      (this.points.geometry.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
      if (visible !== s.visibleCount) s.set({ visibleCount: visible });
    }
    this.selectedMarker.scale.setScalar(1 + 0.15 * Math.sin(this.time * 4));
    this.rig.update(dt);
    const c = this.ctx.renderer.canvas;
    c.dataset.preset = s.preset;
    c.dataset.visible = String(s.visibleCount);
  }

  zoom(factor: number): void {
    if (!this.ready) return;
    this.rig.cancelFlight();
    void this.rig.flyTo({ distance: this.rig.pose.distance * factor }, 0.6);
  }

  override commands(): Command[] {
    const s = quakeStore.getState();
    return [
      { id: 'q:all', label: 'Earthquakes: all', group: 'Earthquakes', run: () => s.set({ preset: 'all' }) },
      { id: 'q:pacific', label: 'Earthquakes: Pacific rim', group: 'Earthquakes', run: () => s.set({ preset: 'pacific' }) },
      { id: 'q:japan', label: 'Earthquakes: Japan 2011', group: 'Earthquakes', run: () => s.set({ preset: 'japan2011' }) },
      { id: 'q:deep', label: 'Earthquakes: deep Earth', group: 'Earthquakes', run: () => s.set({ preset: 'deep' }) },
      { id: 'q:play', label: 'Play 25 years of earthquakes', group: 'Earthquakes', run: () => s.set({ throughSeconds: s.range.start, playing: true }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    (this.rig as CameraRig | undefined)?.dispose();
    this.stars.dispose();
    super.unmount();
  }
}
