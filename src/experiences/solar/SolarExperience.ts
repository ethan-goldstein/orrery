import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { MilkyWay } from '@/engine/MilkyWay';
import { CameraRig } from '@/engine/CameraRig';
import { Labels, type LabelEntry } from '@/engine/Labels';
import { Picker } from '@/engine/Picker';
import { OrbitLine } from '@/engine/OrbitLine';
import { loadTexture } from '@/engine/Assets';
import { createPlanetMaterial } from '@/engine/materials/PlanetMaterial';
import { createSunMaterial, createCoronaSprite } from '@/engine/materials/SunMaterial';
import { createEarthMaterial, createCloudMaterial } from '@/engine/materials/EarthMaterial';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import { createRingGeometry, createRingMaterial } from '@/engine/materials/RingMaterial';
import type { ClockState } from '@/astro/time';
import { BODIES, bodyInfo, moonsOf, PLANETS, type BodyInfo } from '@/astro/bodies';
import { galileanPositionKm, isGalilean, keplerMoonElements, keplerMoonPositionKm, loadKeplerMoons, moonPhaseDeg, moonPositionKm, planetPositionKm, planetStateKm, type Km3 } from '@/astro/ephemeris';
import { bodyOrientation, hasIauOrientation } from '@/astro/rotation';
import { elementsFromState, samplePath } from '@/astro/kepler';
import { AU_KM, blendLog, blendPosition, illustratedDistanceUnits, quintic, UNITS_PER_KM } from '@/astro/scale';
import { solarStore, type SolarView } from '@/store/solar';
import { settingsStore } from '@/store/settings';
import { clockStore } from '@/store/clock';

const SUN_GM = 1.32712440018e11; // km^3/s^2
const TOUR_ORDER = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'io', 'saturn', 'titan', 'uranus', 'neptune', 'pluto'];

interface Node {
  info: BodyInfo;
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.Material & { shadowUniforms?: ReturnType<typeof import('@/engine/materials/shadows.glsl').shadowUniforms> };
  atmosphere: ReturnType<typeof createAtmosphereShells> | null;
  clouds: THREE.Mesh | null;
  rings: { mesh: THREE.Mesh; material: ReturnType<typeof createRingMaterial>; inner: number; outer: number }[];
  corona: THREE.Sprite | null;
  /** heliocentric km, scene frame */
  km: Km3;
  /** display position relative to the Sun, scene units */
  display: [number, number, number];
  displayRadius: number;
  /** display position relative to the current origin body */
  scene: THREE.Vector3;
  north: THREE.Vector3;
  path: OrbitLine | null;
  trail: OrbitLine | null;
  trailPoints: number[];
  lastTrailMs: number;
  visible: boolean;
}

export class SolarExperience extends Experience {
  readonly id = 'solar';
  private stars = new Starfield();
  private milkyWay: MilkyWay | null = null;
  private rig!: CameraRig;
  private labels!: Labels;
  private picker!: Picker;
  private ready = false;
  private nodes = new Map<string, Node>();
  private sunLight = new THREE.PointLight(0xfff4e0, 3.2, 0, 0);
  private markers!: THREE.Points;
  private markerPositions!: Float32Array;
  private markerColors!: Float32Array;
  private originId = 'sun';
  private scaleMix = 0;
  private scaleFrom = 0;
  private scaleTo = 0;
  private scaleT = 1;
  private scaleStart = 0;
  private static readonly SCALE_SECONDS = 1.4;
  private lastPathMs = -Infinity;
  private lastPathMix = -1;
  private pathsGroup = new THREE.Group();
  private unsubscribe: (() => void)[] = [];
  private pendingFocus: string | null = null;
  private tourTimer = 0;
  private tourIndex = 0;
  private telemetryTimer = 0;
  private cloudShift = 0;
  private sunUniformTime = 0;
  private lastFrameMs = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    this.camera.near = 0.02;
    this.camera.far = 5e7;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, this.pathsGroup, this.sunLight, new THREE.AmbientLight(0x1a2233, 0.12));
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());

    // bodies
    for (const info of BODIES) this.nodes.set(info.id, this.createNode(info, tier.sphereSegments));

    // markers for pixel-sized bodies
    this.markerPositions = new Float32Array(BODIES.length * 3);
    this.markerColors = new Float32Array(BODIES.length * 3);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(this.markerPositions, 3));
    mg.setAttribute('color', new THREE.BufferAttribute(this.markerColors, 3));
    this.markers = new THREE.Points(mg, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: dotTexture(), transparent: true, depthWrite: false, alphaTest: 0.2 }));
    this.markers.frustumCulled = false;
    this.scene.add(this.markers);

    // camera + input
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: 420_000, phi: 1.05, theta: 0.7 });
    this.rig.limits = { minDistance: 1, maxDistance: 2e7, minPolar: 0.02, maxPolar: Math.PI - 0.02 };
    this.labels = new Labels(ctx.stage);
    this.labels.onSelect = (id) => solarStore.getState().setFocus(id);
    this.picker = new Picker(ctx.stage, this.camera, () => [...this.nodes.values()].map((n) => ({ id: n.info.id, position: n.scene, radius: n.displayRadius, visible: n.visible })));
    this.picker.onPick = (id) => {
      if (id) solarStore.getState().setFocus(id);
    };

    // store subscriptions
    const s = solarStore.getState();
    this.originId = s.focus;
    this.scaleMix = this.scaleTo = this.scaleFrom = this.targetMix(s.view, s.trueScale);
    this.unsubscribe.push(
      solarStore.subscribe((state, prev) => {
        if (state.focus !== prev.focus || state.view !== prev.view) this.onFocusOrView(state.focus, state.view, prev.view);
        if (state.trueScale !== prev.trueScale || state.view !== prev.view) this.animateScale(this.targetMix(state.view, state.trueScale));
        if (state.paths !== prev.paths) this.pathsGroup.visible = state.paths;
        if (state.tour && !prev.tour) {
          this.tourIndex = Math.max(0, TOUR_ORDER.indexOf(state.focus));
          this.tourTimer = 0;
          this.tourStep();
        }
      }),
      settingsStore.subscribe((st) => {
        this.labels.enabled = st.labels;
      }),
    );
    this.labels.enabled = settingsStore.getState().labels;
    this.pathsGroup.visible = s.paths;
    this.applyView(s.focus, s.view, true);

    this.ready = true;
    // async assets: never block the first frame
    void this.loadAssets(ctx, tier.textureTier);
    await Promise.all([this.stars.load(ctx.signal).catch(() => undefined), loadKeplerMoons(ctx.signal).catch((e) => console.warn('moons', e))]);
  }

  private async loadAssets(ctx: ExperienceContext, tier: '1k' | '2k' | '4k'): Promise<void> {
    const { signal } = ctx;
    const tasks: Promise<void>[] = [];
    tasks.push(
      loadTexture('milky-way', tier === '4k' ? '2k' : tier).then((tex) => {
        if (signal.aborted) return;
        this.milkyWay = new MilkyWay(tex, 0.5);
        this.scene.add(this.milkyWay.mesh);
      }),
    );
    for (const node of this.nodes.values()) {
      const info = node.info;
      if (info.id === 'earth') {
        tasks.push(
          (async () => {
            const [day, night, normal, specular, clouds] = await Promise.all([
              loadTexture('earth-day', tier),
              loadTexture('earth-night', tier).catch(() => null),
              loadTexture('earth-normal', tier).catch(() => null),
              loadTexture('earth-specular', tier).catch(() => null),
              loadTexture('earth-clouds', tier).catch(() => null),
            ]);
            if (signal.aborted) return;
            const mat = createEarthMaterial({ day, night, normal, specular, clouds });
            const old = node.material;
            node.mesh.material = mat;
            node.material = mat;
            old.dispose();
            if (clouds) {
              const cm = new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 64), createCloudMaterial(clouds));
              cm.renderOrder = 1;
              node.group.add(cm);
              node.clouds = cm;
            }
          })(),
        );
        continue;
      }
      if (info.texture) {
        tasks.push(
          loadTexture(info.texture, info.id === 'sun' ? '2k' : tier).then((tex) => {
            if (signal.aborted) return;
            if (info.id === 'sun') {
              (node.material as THREE.ShaderMaterial).uniforms.uMap!.value = tex;
              (node.material as THREE.ShaderMaterial).uniforms.uHasMap!.value = 1;
            } else {
              const m = node.material as THREE.MeshStandardMaterial;
              m.map = tex;
              m.color.set(0xffffff);
              m.needsUpdate = true;
            }
          }),
        );
      }
      for (const ring of node.rings) {
        const def = info.rings?.find((r) => r.texture);
        if (def?.texture) {
          tasks.push(
            loadTexture(def.texture, tier === '1k' ? '1k' : '2k').then((tex) => {
              if (signal.aborted) return;
              ring.material.uniforms.uMap!.value = tex;
              ring.material.uniforms.uHasMap!.value = 1;
              const pm = node.material.shadowUniforms;
              if (pm) pm.uRingMap.value = tex;
            }),
          );
        }
      }
    }
    await Promise.allSettled(tasks);
  }

  private createNode(info: BodyInfo, segments: number): Node {
    const group = new THREE.Group();
    group.name = info.id;
    const seg = info.kind === 'moon' ? Math.max(48, segments / 2) : segments;
    const geo = new THREE.SphereGeometry(1, seg, seg / 2);
    let material: Node['material'];
    let corona: THREE.Sprite | null = null;
    if (info.emissive) {
      material = createSunMaterial(null);
      corona = createCoronaSprite();
      corona.scale.setScalar(6);
      group.add(corona);
    } else {
      material = createPlanetMaterial({ color: info.color, procedural: !info.texture, roughness: info.kind === 'moon' ? 1 : 0.9 });
    }
    const mesh = new THREE.Mesh(geo, material);
    if (info.flattening) mesh.scale.set(1, 1 - info.flattening, 1);
    group.add(mesh);
    let atmosphere: Node['atmosphere'] = null;
    if (info.atmosphere) {
      atmosphere = createAtmosphereShells(info.atmosphere.color, info.atmosphere.twilight, info.atmosphere.thickness);
      group.add(atmosphere.inner, atmosphere.outer);
    }
    const rings: Node['rings'] = [];
    for (const r of info.rings ?? []) {
      const inner = r.innerKm / info.radiusKm;
      const outer = r.outerKm / info.radiusKm;
      const rm = createRingMaterial(null, r.color, r.opacity);
      const rmesh = new THREE.Mesh(createRingGeometry(inner, outer, 256), rm);
      rmesh.renderOrder = 4;
      group.add(rmesh);
      rings.push({ mesh: rmesh, material: rm, inner, outer });
      const pm = material.shadowUniforms;
      if (pm && r.texture) {
        pm.uRingEnabled.value = 1;
        pm.uRingOpacity.value = r.opacity;
      }
    }
    const path = info.kind === 'star' ? null : new OrbitLine(info.color, info.kind === 'moon' ? 0.35 : 0.42, info.kind === 'moon' ? 1 : 1.3);
    if (path) this.pathsGroup.add(path.line);
    const trail = info.kind === 'planet' || info.kind === 'dwarf' ? new OrbitLine(info.color, 0.7, 1.6) : null;
    if (trail) this.scene.add(trail.line);
    this.scene.add(group);
    return { info, group, mesh, material, atmosphere, clouds: null, rings, corona, km: [0, 0, 0], display: [0, 0, 0], displayRadius: 1, scene: new THREE.Vector3(), north: new THREE.Vector3(0, 1, 0), path, trail, trailPoints: [], lastTrailMs: -Infinity, visible: true };
  }

  /* ---------- view / focus ---------- */

  private targetMix(view: SolarView, trueScale: boolean): number {
    return view === 'system' || view === 'inner' ? (trueScale ? 1 : 0) : 1;
  }

  /** Line-up order for the compare view: Sun first, then planets by distance, then the Moon and Pluto. */
  private static readonly LINEUP = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

  private animateScale(to: number): void {
    if (Math.abs(to - this.scaleTo) < 1e-6) return;
    this.scaleFrom = this.scaleMix;
    this.scaleTo = to;
    this.scaleT = 0;
    this.scaleStart = performance.now();
  }

  private onFocusOrView(focus: string, view: SolarView, prevView: SolarView): void {
    const clock = clockStore.getState();
    if (!clock.followNow) {
      // contextual rates, like a good documentary editor: slow down for close-ups
      if ((view === 'moons' || view === 'planet') && prevView !== view && clock.rate > 86_400) clock.setRate(view === 'moons' ? 3600 : 60);
      if ((view === 'system' || view === 'inner') && prevView !== view && clock.rate < 3600) clock.setRate(259_200);
    }
    this.applyView(focus, view, false);
  }

  /** Camera distance that fits a sphere of the given radius with some margin. */
  private fitRadius(radius: number, margin = 1.12): number {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fov = Math.min(vFov, hFov);
    return (radius / Math.sin(fov / 2)) * margin;
  }

  private fitDistance(focus: Node, view: SolarView): number {
    if (view === 'planet') return Math.max(this.fitRadius(focus.displayRadius * (focus.rings.length ? 2.4 : 1.0), 1.35), 0.5);
    if (view === 'moons') {
      const moons = moonsOf(focus.info.id).map((m) => this.nodes.get(m.id)!);
      if (moons.length === 0) return focus.displayRadius * 8;
      const far = Math.max(...moons.map((m) => Math.hypot(m.display[0] - focus.display[0], m.display[1] - focus.display[1], m.display[2] - focus.display[2])));
      return this.fitRadius(far, 1.15);
    }
    if (view === 'compare') {
      const first = this.nodes.get('mercury')!;
      const last = this.nodes.get('pluto')!;
      return this.fitRadius((last.display[0] - first.display[0]) * 0.55 + last.displayRadius, 1.15);
    }
    if (view === 'inner') {
      const mars = this.nodes.get('mars')!;
      return this.fitRadius(Math.hypot(...mars.display), 1.25);
    }
    const nep = this.nodes.get('neptune')!;
    return this.fitRadius(Math.hypot(...nep.display), 1.08);
  }

  private applyView(focus: string, view: SolarView, immediate: boolean): void {
    const clock = clockStore.getState();
    this.updatePositions(clock.epochMs, this.scaleMix);
    const focusNode = this.nodes.get(focus) ?? this.nodes.get('sun')!;
    const anchorId = view === 'system' || view === 'inner' ? 'sun' : view === 'compare' ? 'saturn' : focus;
    const anchor = this.nodes.get(anchorId)!;
    // re-centre the scene on the anchor, keeping the camera where it is
    const prev = this.nodes.get(this.originId)!;
    const delta = new THREE.Vector3(anchor.display[0] - prev.display[0], anchor.display[1] - prev.display[1], anchor.display[2] - prev.display[2]);
    this.originId = anchorId;
    this.rig.pose.target.sub(delta);
    this.updatePositions(clock.epochMs, this.scaleMix);
    const distance = this.fitDistance(anchor, view);
    const phi = view === 'planet' ? 1.35 : view === 'moons' ? 1.15 : view === 'compare' ? 1.5 : 1.02;
    let theta = view === 'compare' ? Math.PI / 2 : this.rig.pose.theta;
    if (view === 'planet' && anchorId !== 'sun') {
      // stand between the Sun and the world, a little to one side so the terminator shows
      const sunDir = new THREE.Vector3().subVectors(this.nodes.get('sun')!.scene, anchor.scene).normalize();
      theta = Math.atan2(sunDir.x, sunDir.z) + 0.55;
    }
    this.rig.limits.minDistance = anchor.displayRadius * 1.08;
    this.pendingFocus = focusNode.info.id;
    if (immediate) {
      this.rig.importPose({ theta, phi, distance, target: new THREE.Vector3() });
    } else {
      void this.rig.flyTo({ target: new THREE.Vector3(), distance, phi, theta }, view === 'planet' ? 1.8 : 2.2);
    }
    this.ctx.renderer.canvas.dataset.focus = focus;
    this.ctx.renderer.canvas.dataset.view = view;
  }

  /* ---------- per-frame ---------- */

  private updatePositions(ms: number, mix: number): void {
    const sun = this.nodes.get('sun')!;
    sun.km = [0, 0, 0];
    sun.display = [0, 0, 0];
    sun.displayRadius = blendLog(sun.info.illustratedRadiusUnits, sun.info.radiusKm * UNITS_PER_KM, mix);
    for (const info of BODIES) {
      if (info.kind === 'star') continue;
      const node = this.nodes.get(info.id)!;
      if (info.kind === 'planet' || info.kind === 'dwarf') {
        try {
          node.km = planetPositionKm(info.id, ms);
        } catch {
          node.km = [0, 0, 0];
        }
        const d = Math.hypot(...node.km);
        node.display = blendPosition(node.km, illustratedDistanceUnits(d), mix);
        node.displayRadius = blendLog(info.illustratedRadiusUnits, info.radiusKm * UNITS_PER_KM, mix);
        node.visible = true;
      }
    }
    for (const info of BODIES) {
      if (info.kind !== 'moon') continue;
      const node = this.nodes.get(info.id)!;
      const parent = this.nodes.get(info.parent!)!;
      let rel: Km3 | null;
      if (info.id === 'moon') rel = moonPositionKm(ms);
      else if (isGalilean(info.id)) rel = galileanPositionKm(info.id, ms);
      else rel = keplerMoonPositionKm(info.id, ms);
      if (!rel) {
        node.visible = false;
        continue;
      }
      node.km = [parent.km[0] + rel[0], parent.km[1] + rel[1], parent.km[2] + rel[2]];
      // in illustrated mode moons sit just outside their (enlarged) parent, in true mode at true distance
      const trueUnits = Math.hypot(...rel) * UNITS_PER_KM;
      const illustrated = parent.displayRadius * 2.2 + trueUnits * 0.02;
      const units = blendLog(illustrated, trueUnits, mix);
      const k = units / Math.hypot(...rel);
      node.display = [parent.display[0] + rel[0] * k, parent.display[1] + rel[1] * k, parent.display[2] + rel[2] * k];
      node.displayRadius = blendLog(info.illustratedRadiusUnits * 0.35, info.radiusKm * UNITS_PER_KM, mix);
      node.visible = true;
    }
    if (solarStore.getState().view === 'compare') {
      // true radii side by side along +X, touching with a small gap, the Sun on the left
      let x = 0;
      let prev = 0;
      for (const id of SolarExperience.LINEUP) {
        const node = this.nodes.get(id)!;
        node.displayRadius = node.info.radiusKm * UNITS_PER_KM;
        x += prev + node.displayRadius + (prev ? Math.max(0.6, (prev + node.displayRadius) * 0.08) : 0);
        node.display = [x, 0, 0];
        prev = node.displayRadius;
      }
      for (const node of this.nodes.values()) if (!SolarExperience.LINEUP.includes(node.info.id)) node.visible = false;
    }
    const origin = this.nodes.get(this.originId)!;
    for (const node of this.nodes.values()) {
      node.scene.set(node.display[0] - origin.display[0], node.display[1] - origin.display[1], node.display[2] - origin.display[2]);
    }
    this.pathsGroup.position.set(-origin.display[0], -origin.display[1], -origin.display[2]);
  }

  private updateOrientation(ms: number): void {
    const sun = this.nodes.get('sun')!;
    for (const node of this.nodes.values()) {
      const info = node.info;
      if (hasIauOrientation(info.id)) {
        const o = bodyOrientation(info.id, ms, info.textureOffsetDeg ?? 0);
        if (o) {
          node.group.quaternion.copy(o.quaternion);
          node.north.copy(o.north);
        }
      } else if (info.parent) {
        // tidally locked: north follows the parent, prime meridian faces the parent
        const parent = this.nodes.get(info.parent)!;
        const north = parent.north.clone();
        const toParent = new THREE.Vector3().subVectors(parent.scene, node.scene);
        toParent.addScaledVector(north, -toParent.dot(north)).normalize();
        if (toParent.lengthSq() < 1e-6) toParent.set(1, 0, 0);
        const Z = new THREE.Vector3().crossVectors(toParent, north).normalize();
        const m = new THREE.Matrix4().makeBasis(toParent, north, Z);
        node.group.quaternion.setFromRotationMatrix(m);
        node.north.copy(north);
      }
      node.group.position.copy(node.scene);
      const r = node.displayRadius;
      node.group.scale.setScalar(r);
      if (node.atmosphere) node.atmosphere.setSun(new THREE.Vector3().subVectors(sun.scene, node.scene).normalize());
      if (node.corona) node.corona.scale.setScalar(6.5);
      node.group.visible = node.visible;
    }
  }

  private updateShadows(): void {
    const sun = this.nodes.get('sun')!;
    for (const node of this.nodes.values()) {
      const u = node.material.shadowUniforms;
      const targets = [u, ...node.rings.map((r) => r.material.shadowUniforms)].filter(Boolean) as NonNullable<typeof u>[];
      if (targets.length === 0) continue;
      const casters: [number, number, number, number][] = [];
      const push = (other: Node | undefined) => {
        if (other && other.visible && other !== node && casters.length < 3) casters.push([other.scene.x, other.scene.y, other.scene.z, other.displayRadius]);
      };
      if (node.info.kind === 'moon') push(this.nodes.get(node.info.parent!));
      if (node.info.id === 'earth') push(this.nodes.get('moon'));
      if (node.info.id === 'moon') push(this.nodes.get('earth'));
      if (node.info.kind === 'planet') for (const m of moonsOf(node.info.id)) push(this.nodes.get(m.id));
      for (const t of targets) {
        t.uSunPos.value = [sun.scene.x, sun.scene.y, sun.scene.z];
        t.uSunRadius.value = sun.displayRadius;
        t.uCasterCount.value = casters.length;
        for (let i = 0; i < 3; i++) t.uCasters.value.set(casters[i] ?? [0, 0, 0, 0], i * 4);
      }
      if (u && node.rings.length && u.uRingEnabled.value) {
        const ring = node.rings[0]!;
        u.uRingCenter.value = [node.scene.x, node.scene.y, node.scene.z];
        u.uRingNormal.value = [node.north.x, node.north.y, node.north.z];
        u.uRingInner.value = ring.inner * node.displayRadius;
        u.uRingOuter.value = ring.outer * node.displayRadius;
      }
    }
  }

  private updatePaths(ms: number, mix: number, force: boolean): void {
    const rate = Math.abs(clockStore.getState().rate);
    const due = force || Math.abs(mix - this.lastPathMix) > 0.002 || Math.abs(ms - this.lastPathMs) > Math.max(86_400_000 * 3, rate * 2000);
    if (!due) return;
    this.lastPathMs = ms;
    this.lastPathMix = mix;
    const focus = solarStore.getState().focus;
    for (const node of this.nodes.values()) {
      if (!node.path) continue;
      const info = node.info;
      let pts: number[] = [];
      if (info.kind === 'planet' || info.kind === 'dwarf') {
        try {
          const { r, v } = planetStateKm(info.id, ms);
          const el = elementsFromState(r, v, SUN_GM, ms);
          for (const p of samplePath(el, ms, 240)) {
            const d = blendPosition(p, illustratedDistanceUnits(Math.hypot(...p)), mix);
            pts.push(d[0], d[1], d[2]);
          }
        } catch {
          pts = [];
        }
      } else if (info.kind === 'moon') {
        const parent = this.nodes.get(info.parent!)!;
        const showMoons = focus === info.parent || focus === info.id || moonsOf(info.parent!).some((m) => m.id === focus);
        if (!showMoons || mix < 0.98) {
          node.path.line.visible = false;
          continue;
        }
        let samples: Km3[] = [];
        if (info.id === 'moon' || isGalilean(info.id)) {
          const period = Math.abs(info.periodDays ?? 27) * 86_400_000;
          for (let k = 0; k <= 120; k++) {
            const t = ms + (period * k) / 120;
            samples.push(info.id === 'moon' ? moonPositionKm(t) : galileanPositionKm(info.id as 'io', t));
          }
        } else {
          const el = keplerMoonElements(info.id);
          if (el) samples = samplePath(el, ms, 120);
        }
        for (const p of samples) pts.push(parent.display[0] + p[0] * UNITS_PER_KM, parent.display[1] + p[1] * UNITS_PER_KM, parent.display[2] + p[2] * UNITS_PER_KM);
      }
      node.path.setPoints(pts);
      node.path.line.visible = pts.length > 0;
    }
  }

  private updateTrails(ms: number, mix: number): void {
    const show = solarStore.getState().trails && mix < 0.5;
    const origin = this.nodes.get(this.originId)!;
    for (const node of this.nodes.values()) {
      if (!node.trail) continue;
      if (!show) {
        node.trail.line.visible = false;
        node.trailPoints.length = 0;
        node.lastTrailMs = -Infinity;
        continue;
      }
      const period = (node.info.periodDays ?? 365) * 86_400_000;
      const step = period / 90;
      if (Math.abs(ms - node.lastTrailMs) > period * 0.5) {
        node.trailPoints.length = 0;
        node.lastTrailMs = ms - step;
      }
      if (ms - node.lastTrailMs >= step) {
        node.trailPoints.push(node.display[0], node.display[1], node.display[2]);
        node.lastTrailMs = ms;
        if (node.trailPoints.length > 3 * 40) node.trailPoints.splice(0, node.trailPoints.length - 3 * 40);
      }
      if (node.trailPoints.length >= 6) {
        const pts = node.trailPoints.slice();
        pts.push(node.display[0], node.display[1], node.display[2]);
        for (let i = 0; i < pts.length; i += 3) {
          pts[i] = pts[i]! - origin.display[0];
          pts[i + 1] = pts[i + 1]! - origin.display[1];
          pts[i + 2] = pts[i + 2]! - origin.display[2];
        }
        node.trail.setPoints(pts);
        node.trail.line.visible = true;
      } else node.trail.line.visible = false;
    }
  }

  private updateMarkersAndLabels(): void {
    const state = solarStore.getState();
    const focusNode = this.nodes.get(state.focus)!;
    const h = this.ctx.stage.clientHeight || 1;
    const fovScale = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const entries: LabelEntry[] = [];
    let mi = 0;
    for (const node of this.nodes.values()) {
      const info = node.info;
      const dist = node.scene.distanceTo(this.camera.position);
      const px = (node.displayRadius / dist) * fovScale;
      const isMoon = info.kind === 'moon';
      const moonRelevant = !isMoon || info.parent === state.focus || info.id === state.focus || (focusNode.info.kind === 'moon' && info.parent === focusNode.info.parent);
      const showMoon = state.view === 'compare' ? info.id === 'moon' : moonRelevant && (this.scaleMix > 0.5 || state.view === 'moons' || state.view === 'planet');
      const visible = node.visible && (!isMoon || showMoon);
      node.group.visible = visible;
      if (node.path) {
        const wide = state.view === 'system' || state.view === 'inner';
        if (state.view === 'compare') node.path.line.visible = false;
        node.path.line.visible = node.path.line.visible && visible && (isMoon ? !wide : wide);
      }
      if (!visible) continue;
      // marker for tiny bodies
      if (px < 1.6 && info.id !== 'sun') {
        this.markerPositions.set([node.scene.x, node.scene.y, node.scene.z], mi * 3);
        const c = new THREE.Color(info.color);
        this.markerColors.set([c.r, c.g, c.b], mi * 3);
        mi++;
      }
      entries.push({ id: info.id, text: info.name, color: info.color, priority: info.kind === 'star' ? 5 : info.kind === 'planet' ? 4 : info.kind === 'dwarf' ? 2 : 1, position: node.scene, radius: node.displayRadius, visible: dist > node.displayRadius * 1.02 && !(info.id === state.focus && px > 40) });
    }
    this.markers.geometry.setDrawRange(0, mi);
    (this.markers.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.markers.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    const occluder = { center: focusNode.scene, radius: focusNode.displayRadius };
    this.labels.update(entries, this.camera, occluder, state.focus);
  }

  private tourStep(): void {
    const id = TOUR_ORDER[this.tourIndex % TOUR_ORDER.length]!;
    const info = bodyInfo(id);
    solarStore.setState({ focus: id, view: info.kind === 'moon' ? 'planet' : this.tourIndex % 3 === 2 ? 'moons' : 'planet' });
  }

  update(dt: number, clock: ClockState): void {
    if (!this.ready) return;
    const ms = clock.epochMs;
    const state = solarStore.getState();
    // scale animation
    if (this.scaleT < 1) {
      this.scaleT = Math.min(1, (performance.now() - this.scaleStart) / (SolarExperience.SCALE_SECONDS * 1000));
      this.scaleMix = this.scaleFrom + (this.scaleTo - this.scaleFrom) * quintic(this.scaleT);
      if (Math.abs(state.scaleMix - this.scaleMix) > 0.01 || this.scaleT === 1) solarStore.setState({ scaleMix: this.scaleMix });
    }
    this.updatePositions(ms, this.scaleMix);
    if (this.rig.flying) {
      const anchor = this.nodes.get(this.originId)!;
      this.rig.limits.minDistance = anchor.displayRadius * 1.08;
      this.rig.retarget(new THREE.Vector3(), this.fitDistance(anchor, state.view));
    } else if (this.scaleT < 1) {
      const anchor = this.nodes.get(this.originId)!;
      this.rig.pose.distance = this.fitDistance(anchor, state.view);
    }
    this.updateOrientation(ms);
    // Earth clouds drift
    const earth = this.nodes.get('earth')!;
    if (earth.clouds) {
      this.cloudShift = ((ms / 86_400_000) * 0.02) % 1;
      const cm = earth.clouds.material as THREE.ShaderMaterial;
      cm.uniforms.uShift!.value = this.cloudShift;
      cm.uniforms.uSunDir!.value.copy(new THREE.Vector3().subVectors(this.nodes.get('sun')!.scene, earth.scene).normalize());
      const em = earth.material as THREE.ShaderMaterial;
      if (em.uniforms?.uCloudShift) {
        em.uniforms.uCloudShift.value = this.cloudShift;
        em.uniforms.uSunDir!.value.copy(cm.uniforms.uSunDir!.value);
      }
    } else if ((earth.material as THREE.ShaderMaterial).uniforms?.uSunDir) {
      (earth.material as THREE.ShaderMaterial).uniforms.uSunDir!.value.copy(new THREE.Vector3().subVectors(this.nodes.get('sun')!.scene, earth.scene).normalize());
    }
    // sun
    const sun = this.nodes.get('sun')!;
    this.sunUniformTime += dt;
    (sun.material as THREE.ShaderMaterial).uniforms.uTime!.value = this.sunUniformTime;
    this.sunLight.position.copy(sun.scene);
    this.updateShadows();
    this.updatePaths(ms, this.scaleMix, false);
    this.updateTrails(ms, this.scaleMix);
    this.rig.update(dt);
    this.updateMarkersAndLabels();
    // tour
    if (state.tour) {
      this.tourTimer += dt;
      if (this.tourTimer > 11) {
        this.tourTimer = 0;
        this.tourIndex = (this.tourIndex + 1) % TOUR_ORDER.length;
        this.tourStep();
      }
      if (!this.rig.flying) this.rig.pose.theta += dt * 0.05;
    }
    // telemetry 5x/s
    this.telemetryTimer += dt;
    if (this.telemetryTimer > 0.2) {
      this.telemetryTimer = 0;
      const f = this.nodes.get(state.focus)!;
      const parent = f.info.parent ? this.nodes.get(f.info.parent)! : null;
      const parentDistanceKm = parent ? Math.hypot(f.km[0] - parent.km[0], f.km[1] - parent.km[1], f.km[2] - parent.km[2]) : 0;
      const camKm = (this.camera.position.distanceTo(f.scene) - f.displayRadius) / UNITS_PER_KM;
      solarStore.setState({ telemetry: { parentDistanceKm, sunDistanceKm: Math.hypot(...f.km), cameraAltitudeKm: camKm, moonCount: moonsOf(state.focus).length, moonPhaseDeg: moonPhaseDeg(ms) } });
      this.ctx.renderer.canvas.dataset.scale = this.scaleMix.toFixed(2);
    }
    this.lastFrameMs = ms;
  }

  override resize(width: number, height: number): void {
    super.resize(width, height);
    for (const node of this.nodes.values()) {
      node.path?.setResolution(width, height);
      node.trail?.setResolution(width, height);
    }
  }

  override commands(): Command[] {
    const s = solarStore.getState();
    const cmds: Command[] = [];
    for (const b of BODIES) cmds.push({ id: `focus:${b.id}`, label: `Go to ${b.name}`, group: b.kind === 'moon' ? 'Moons' : 'Worlds', keywords: [b.kind, b.parent ?? ''], run: () => s.setFocus(b.id, 'planet') });
    cmds.push({ id: 'view:system', label: 'View: Solar System', group: 'Views', run: () => s.setView('system') });
    cmds.push({ id: 'view:inner', label: 'View: Inner worlds', group: 'Views', run: () => s.setView('inner') });
    cmds.push({ id: 'view:moons', label: 'View: Moons of the selected world', group: 'Views', run: () => s.setView('moons') });
    cmds.push({ id: 'view:compare', label: 'View: Compare sizes side by side', group: 'Views', run: () => s.setView('compare') });
    cmds.push({ id: 'scale', label: 'Toggle true scale', group: 'Display', run: () => s.setTrueScale(!solarStore.getState().trueScale) });
    cmds.push({ id: 'paths', label: 'Toggle orbital paths', group: 'Display', run: () => s.setPaths(!solarStore.getState().paths) });
    cmds.push({ id: 'tour', label: 'Start the grand tour', group: 'Display', run: () => s.setTour(true) });
    return cmds;
  }

  override unmount(): void {
    this.unsubscribe.forEach((u) => u());
    this.ready = false;
    (this.rig as CameraRig | undefined)?.dispose();
    (this.labels as Labels | undefined)?.dispose();
    (this.picker as Picker | undefined)?.dispose();
    this.stars.dispose();
    this.milkyWay?.dispose();
    for (const node of this.nodes.values()) {
      node.path?.dispose();
      node.trail?.dispose();
      node.atmosphere?.dispose();
    }
    super.unmount();
  }
}

export { PLANETS, AU_KM };

let dot: THREE.Texture | null = null;
function dotTexture(): THREE.Texture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  dot = new THREE.CanvasTexture(c);
  return dot;
}
