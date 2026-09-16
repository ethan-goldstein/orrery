import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { applyLogDepth } from '@/engine/materials/logDepth';
import { CameraRig } from '@/engine/CameraRig';
import { formatDistanceKm } from '@/engine/motion';
import { UNITS_PER_KM } from '@/astro/scale';
import { assetUrl, loadTexture } from '@/engine/Assets';
import type { ClockState } from '@/astro/time';
import { oceanStore, type OceanPreset } from '@/store/oceans';

const R = 6.371;
const PRESETS: Record<OceanPreset, { lat: number; lon: number; distance: number }> = {
  planet: { lat: 10, lon: -160, distance: R * 3.2 },
  gulf: { lat: 35, lon: -60, distance: R * 1.7 },
  pacific: { lat: 5, lon: -170, distance: R * 2.6 },
  southern: { lat: -70, lon: 20, distance: R * 2.4 },
};

/**
 * Surface currents as GPU particles. Particle state (lon, lat, age, seed)
 * lives in a float render target advected by the OSCAR flow texture; each
 * particle draws as a short streak pointing back along the flow.
 */
export class OceansExperience extends Experience {
  readonly id = 'oceans';
  private stars = new Starfield();
  private rig!: CameraRig;
  private globe!: THREE.Mesh;
  private flow: THREE.Texture | null = null;
  private simScene = new THREE.Scene();
  private simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private simMaterial!: THREE.ShaderMaterial;
  private rtA!: THREE.WebGLRenderTarget;
  private rtB!: THREE.WebGLRenderTarget;
  private streaks!: THREE.LineSegments;
  private streakMaterial!: THREE.ShaderMaterial;
  private size = 256;
  private ready = false;
  private unsub: (() => void)[] = [];
  private frame = 0;
  private time = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    this.size = tier.name === 'low' ? 128 : tier.name === 'med' ? 192 : 320; // 16k / 37k / 102k particles
    this.camera.near = 0.05;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, new THREE.AmbientLight(0x7f96bd, 2.6));
    const sun = new THREE.DirectionalLight(0xfff6e6, 1.2);
    sun.position.set(-30, 40, 60);
    this.scene.add(sun);
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ color: 0x0b1626, roughness: 1 }));
    this.scene.add(this.globe);
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: R * 3.2, phi: 1.4, theta: -1.2 });
    this.rig.limits = { minDistance: R * 1.15, maxDistance: R * 10, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.rig.anchor = { center: new THREE.Vector3(), radius: R };
    this.rig.readout = (d) => `${formatDistanceKm((d - R) / UNITS_PER_KM)} up`;
    this.unsub.push(
      oceanStore.subscribe((s, prev) => {
        if (s.preset !== prev.preset) this.applyPreset(s.preset);
      }),
    );
    this.applyPreset(oceanStore.getState().preset, true);
    this.ready = true;
    void loadTexture('earth-day', tier.textureTier === '1k' ? '1k' : '2k').then((t) => {
      if (ctx.signal.aborted) return;
      const m = this.globe.material as THREE.MeshStandardMaterial;
      m.map = t;
      m.color.set(0x7a8698);
      m.needsUpdate = true;
    });
    const meta = await fetch(assetUrl('data/oceans/index.json'), { signal: ctx.signal }).then((r) => r.json() as Promise<{ date: string }>);
    const loader = new THREE.TextureLoader();
    this.flow = await loader.loadAsync(assetUrl(`data/oceans/flow-${meta.date}.png`));
    if (ctx.signal.aborted) return;
    this.flow.colorSpace = THREE.NoColorSpace;
    this.flow.flipY = false; // row 0 is latitude +90, as the shader assumes
    this.flow.premultiplyAlpha = false;
    this.flow.minFilter = THREE.LinearFilter;
    this.flow.magFilter = THREE.LinearFilter;
    this.flow.wrapS = THREE.RepeatWrapping;
    this.flow.generateMipmaps = false;
    this.buildSimulation(ctx);
    this.ctx.renderer.canvas.dataset.flowDate = meta.date;
    await this.stars.load(ctx.signal).catch(() => undefined);
  }

  private buildSimulation(ctx: ExperienceContext): void {
    const gl = ctx.renderer.gl;
    const n = this.size;
    const floatOk = gl.capabilities.isWebGL2;
    const type = floatOk ? THREE.FloatType : THREE.HalfFloatType;
    const mk = () => new THREE.WebGLRenderTarget(n, n, { type, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
    this.rtA = mk();
    this.rtB = mk();
    // seed
    const seed = new Float32Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      seed[i * 4] = Math.random(); // lon 0..1
      seed[i * 4 + 1] = Math.random(); // lat 0..1
      seed[i * 4 + 2] = Math.random() * 200; // age
      seed[i * 4 + 3] = Math.random(); // rnd
    }
    const seedTex = new THREE.DataTexture(seed, n, n, THREE.RGBAFormat, THREE.FloatType);
    seedTex.needsUpdate = true;
    this.simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: seedTex },
        uFlow: { value: this.flow },
        uDt: { value: 0 },
        uFrame: { value: 0 },
        uReset: { value: 1 },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uState; uniform sampler2D uFlow; uniform float uDt; uniform float uFrame; uniform float uReset;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec4 s = texture2D(uState, vUv);
          if (uReset > 0.5) { gl_FragColor = s; return; }
          vec2 uv = s.xy; // lon 0..1 (-180..180), lat 0..1 (90..-90)
          vec4 f = texture2D(uFlow, uv);
          vec2 vel = (f.rg - 0.5) * 3.0; // m/s east, north
          float lat = (0.5 - uv.y) * 3.14159265;
          float cosLat = max(0.2, cos(lat));
          // degrees per second at the surface: v / (111 km per degree); accelerated for legibility
          float k = uDt * 3600.0 * 24.0 * 3.0 / 111000.0; // 3 days per real second
          uv.x += vel.x * k / cosLat / 360.0;
          uv.y -= vel.y * k / 180.0;
          uv.x = fract(uv.x);
          float age = s.z + 1.0;
          float life = 160.0 + s.w * 240.0;
          bool dead = age > life || f.a < 0.5 || uv.y < 0.03 || uv.y > 0.97 || length(vel) < 0.01;
          if (dead) {
            vec2 r = vec2(hash(vUv + uFrame * 0.001), hash(vUv.yx + uFrame * 0.0017));
            uv = vec2(r.x, 0.06 + r.y * 0.88);
            age = 0.0;
          }
          gl_FragColor = vec4(uv, age, s.w);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial);
    this.simScene.add(quad);
    // prime both targets
    gl.setRenderTarget(this.rtA);
    gl.render(this.simScene, this.simCamera);
    gl.setRenderTarget(this.rtB);
    gl.render(this.simScene, this.simCamera);
    gl.setRenderTarget(null);
    this.simMaterial.uniforms.uReset!.value = 0;

    // streaks: two vertices per particle, index in attribute
    const count = n * n;
    const idx = new Float32Array(count * 2 * 2);
    for (let i = 0; i < count; i++) {
      idx[i * 4] = i % n;
      idx[i * 4 + 1] = Math.floor(i / n);
      idx[i * 4 + 2] = i % n;
      idx[i * 4 + 3] = Math.floor(i / n);
    }
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      end[i * 2] = 0;
      end[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geo.setAttribute('ref', new THREE.BufferAttribute(idx, 2));
    geo.setAttribute('end', new THREE.BufferAttribute(end, 1));
    this.streakMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: this.rtA.texture },
        uFlow: { value: this.flow },
        uSize: { value: n },
        uRadius: { value: R * 1.004 },
        uReveal: { value: 1 },
        uTail: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 ref; attribute float end;
        uniform sampler2D uState; uniform sampler2D uFlow; uniform float uSize; uniform float uRadius; uniform float uReveal; uniform float uTail;
        varying float vSpeed; varying float vAlpha;
        vec3 sphere(vec2 uv) {
          float lon = (uv.x - 0.5) * 6.2831853;
          float lat = (0.5 - uv.y) * 3.14159265;
          return vec3(cos(lat) * cos(lon), sin(lat), -cos(lat) * sin(lon)) * uRadius;
        }
        void main() {
          vec2 tuv = (ref + 0.5) / uSize;
          vec4 s = texture2D(uState, tuv);
          vec4 f = texture2D(uFlow, s.xy);
          vec2 vel = (f.rg - 0.5) * 3.0;
          float speed = length(vel);
          vSpeed = speed;
          float index = ref.y * uSize + ref.x;
          float shown = step(index / (uSize * uSize), uReveal);
          float fade = smoothstep(0.0, 12.0, s.z) * shown * (s.z < 400.0 ? 1.0 : 0.0);
          vAlpha = fade * (end > 0.5 ? 0.0 : 1.0);
          float lat = (0.5 - s.y) * 3.14159265;
          vec2 dir = speed > 0.001 ? vel / speed : vec2(0.0);
          float len = (0.35 + 0.65 * min(1.0, speed / 1.2)) * 0.011 * uTail; // never shorter than a few pixels
          vec2 tail = s.xy - vec2(dir.x / max(0.2, cos(lat)), -dir.y) * len;
          vec3 p = sphere(end > 0.5 ? tail : s.xy);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vSpeed; varying float vAlpha;
        void main() {
          float t = clamp(vSpeed / 1.2, 0.0, 1.0);
          vec3 slow = vec3(0.16, 0.42, 0.75);
          vec3 mid = vec3(0.45, 0.85, 0.95);
          vec3 fast = vec3(1.0, 0.95, 0.75);
          vec3 col = t < 0.5 ? mix(slow, mid, t * 2.0) : mix(mid, fast, (t - 0.5) * 2.0);
          gl_FragColor = vec4(col * (1.4 + 1.6 * t), vAlpha * (0.55 + 0.45 * t));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    applyLogDepth(this.streakMaterial);
    this.streaks = new THREE.LineSegments(geo, this.streakMaterial);
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
    oceanStore.getState().set({ particleCount: count });
  }

  private applyPreset(preset: OceanPreset, immediate = false): void {
    const p = PRESETS[preset];
    const phi = ((90 - p.lat) * Math.PI) / 180;
    const theta = ((p.lon + 90) * Math.PI) / 180;
    const distance = this.rig.fit(p.distance);
    if (immediate) this.rig.importPose({ phi, theta, distance, target: new THREE.Vector3() });
    else void this.rig.flyTo({ phi, theta, distance, target: new THREE.Vector3() });
  }

  update(dt: number, _clock: ClockState): void {
    if (!this.ready) return;
    const s = oceanStore.getState();
    this.time += dt;
    if (this.simMaterial && this.flow) {
      const gl = this.ctx.renderer.gl;
      const step = s.playing ? Math.min(dt, 0.05) * s.speed : 0;
      this.simMaterial.uniforms.uState!.value = this.rtA.texture;
      this.simMaterial.uniforms.uDt!.value = step;
      this.simMaterial.uniforms.uFrame!.value = this.frame++;
      gl.setRenderTarget(this.rtB);
      gl.render(this.simScene, this.simCamera);
      gl.setRenderTarget(null);
      [this.rtA, this.rtB] = [this.rtB, this.rtA];
      this.streakMaterial.uniforms.uState!.value = this.rtA.texture;
      this.streakMaterial.uniforms.uReveal!.value = s.reveal;
    }
    this.globe.rotation.set(0, 0, 0);
    // diagnostics: read a few particles back every 30 frames so tests can see motion
    if (this.rtA && this.frame % 30 === 0) {
      const px = new Float32Array(4 * 4);
      this.ctx.renderer.gl.readRenderTargetPixels(this.rtA, 0, 0, 4, 1, px);
      this.ctx.renderer.canvas.dataset.sample = Array.from(px.slice(0, 8)).map((v) => v.toFixed(3)).join(',');
      let alive = 0;
      for (let i = 0; i < 4; i++) if (px[i * 4 + 2]! > 0) alive++;
      this.ctx.renderer.canvas.dataset.alive = String(alive);
    }
    this.rig.update(dt);
    const c = this.ctx.renderer.canvas;
    c.dataset.preset = s.preset;
    c.dataset.particles = String(s.particleCount);
    c.dataset.playing = s.playing ? 'true' : 'false';
  }

  override commands(): Command[] {
    const s = oceanStore.getState();
    return [
      { id: 'o:planet', label: 'Oceans: ocean planet', group: 'Oceans', run: () => s.set({ preset: 'planet' }) },
      { id: 'o:gulf', label: 'Oceans: Gulf Stream', group: 'Oceans', run: () => s.set({ preset: 'gulf' }) },
      { id: 'o:pacific', label: 'Oceans: Pacific', group: 'Oceans', run: () => s.set({ preset: 'pacific' }) },
      { id: 'o:southern', label: 'Oceans: Southern Ocean', group: 'Oceans', run: () => s.set({ preset: 'southern' }) },
      { id: 'o:pause', label: 'Pause / resume currents', group: 'Oceans', run: () => s.set({ playing: !oceanStore.getState().playing }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    (this.rig as CameraRig | undefined)?.dispose();
    this.stars.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.simMaterial?.dispose();
    this.streakMaterial?.dispose();
    this.flow?.dispose();
    super.unmount();
  }
}
