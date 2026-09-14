import * as THREE from 'three';
import { Experience, type Command, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { CameraRig } from '@/engine/CameraRig';
import { Labels, type LabelEntry } from '@/engine/Labels';
import { assetUrl, loadTexture } from '@/engine/Assets';
import { createEarthMaterial, createCloudMaterial } from '@/engine/materials/EarthMaterial';
import { createAtmosphereShells } from '@/engine/materials/AtmosphereShell';
import type { ClockState } from '@/astro/time';
import { civStore } from '@/store/civ';
import { latLon } from '@/experiences/moon/MoonExperience';

export interface Chapter { n: number; id: string; title: string; when: string; year: number; lat: number; lon: number; zoom: number; night: boolean; story: string; source: string }

const R = 6.371;

/**
 * Eighteen chapters of the human story on a globe: fly-to per chapter,
 * coastlines, markers that light up as history advances, and night lights
 * that only appear once electricity exists.
 */
export class CivilizationExperience extends Experience {
  readonly id = 'civilization';
  private stars = new Starfield();
  private rig!: CameraRig;
  private labels!: Labels;
  private globe!: THREE.Mesh;
  private clouds: THREE.Mesh | null = null;
  private atmo: ReturnType<typeof createAtmosphereShells> | null = null;
  private sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
  private chapters: Chapter[] = [];
  private markers = new THREE.Group();
  private coast: THREE.LineSegments | null = null;
  private ready = false;
  private unsub: (() => void)[] = [];
  private playTimer = 0;
  private time = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    const tier = ctx.renderer.tier;
    this.camera.near = 0.05;
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.stars.points, this.sun, new THREE.AmbientLight(0x101a2a, 0.6), this.markers);
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(R, tier.sphereSegments, tier.sphereSegments / 2), new THREE.MeshStandardMaterial({ color: 0x1d3a6a, roughness: 1 }));
    this.scene.add(this.globe);
    this.atmo = createAtmosphereShells('#6fb1ff', '#ff7a3d', 0.035);
    this.atmo.inner.scale.multiplyScalar(R);
    this.atmo.outer.scale.multiplyScalar(R);
    this.scene.add(this.atmo.inner, this.atmo.outer);
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: R * 2.6, phi: 1.2, theta: 1.4 });
    this.rig.limits = { minDistance: R * 1.15, maxDistance: R * 10, minPolar: 0.05, maxPolar: Math.PI - 0.05 };
    this.rig.element.addEventListener('pointerdown', () => civStore.getState().set({ playing: false }));
    this.labels = new Labels(ctx.stage);
    this.labels.onSelect = (id) => civStore.getState().set({ chapter: Number(id), playing: false });
    this.unsub.push(
      civStore.subscribe((s, prev) => {
        if (s.chapter !== prev.chapter) this.flyChapter(s.chapter);
      }),
    );
    this.ready = true;
    void this.loadEarth(ctx, tier.textureTier);
    await Promise.all([
      this.stars.load(ctx.signal).catch(() => undefined),
      fetch(assetUrl('data/civ/chapters.json'), { signal: ctx.signal })
        .then((r) => r.json() as Promise<{ chapters: Chapter[] }>)
        .then((d) => {
          this.chapters = d.chapters;
          civStore.getState().set({ chapterCount: d.chapters.length });
          this.buildMarkers();
          this.flyChapter(civStore.getState().chapter, true);
        }),
      fetch(assetUrl('data/civ/coastlines.json'), { signal: ctx.signal })
        .then((r) => r.json() as Promise<{ lines: number[][] }>)
        .then((d) => this.buildCoast(d.lines))
        .catch(() => undefined),
    ]);
  }

  private async loadEarth(ctx: ExperienceContext, tier: '1k' | '2k' | '4k'): Promise<void> {
    const [day, night, normal, specular, clouds] = await Promise.all([loadTexture('earth-day', tier), loadTexture('earth-night', tier).catch(() => null), loadTexture('earth-normal', tier).catch(() => null), loadTexture('earth-specular', tier).catch(() => null), loadTexture('earth-clouds', tier === '4k' ? '2k' : tier).catch(() => null)]);
    if (ctx.signal.aborted) return;
    (this.globe.material as THREE.Material).dispose();
    this.globe.material = createEarthMaterial({ day, night, normal, specular, clouds });
    if (clouds) {
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 96, 64), createCloudMaterial(clouds));
      this.clouds.renderOrder = 1;
      (this.clouds.material as THREE.ShaderMaterial).uniforms.uOpacity!.value = 0.55;
      this.scene.add(this.clouds);
    }
  }

  private buildCoast(lines: number[][]): void {
    const pts: number[] = [];
    for (const line of lines) {
      for (let i = 2; i < line.length; i += 2) {
        const a = latLon(line[i - 1]!, line[i - 2]!, R * 1.006);
        const b = latLon(line[i + 1]!, line[i]!, R * 1.006);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    this.coast = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc9d3e3, transparent: true, opacity: 0.18, depthWrite: false }));
    this.scene.add(this.coast);
  }

  private buildMarkers(): void {
    this.markers.clear();
    const geo = new THREE.SphereGeometry(0.035, 16, 12);
    const ring = new THREE.RingGeometry(0.06, 0.075, 40);
    for (const c of this.chapters) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      m.position.copy(latLon(c.lat, c.lon, R * 1.008));
      m.name = String(c.n);
      const r = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffd27a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      r.position.copy(m.position);
      r.lookAt(m.position.clone().multiplyScalar(2));
      r.name = `ring-${c.n}`;
      this.markers.add(m, r);
    }
  }

  private flyChapter(index: number, immediate = false): void {
    const c = this.chapters[index];
    if (!c) return;
    const phi = ((90 - c.lat) * Math.PI) / 180;
    const theta = ((c.lon + 90) * Math.PI) / 180;
    const distance = R * (1 + c.zoom * 0.42);
    if (immediate) this.rig.importPose({ phi, theta, distance, target: new THREE.Vector3() });
    else void this.rig.flyTo({ phi, theta, distance }, 2.2);
    civStore.getState().set({ night: c.night });
  }

  update(dt: number, _clock: ClockState): void {
    if (!this.ready) return;
    this.time += dt;
    const s = civStore.getState();
    const c = this.chapters[s.chapter];
    if (s.playing && this.chapters.length) {
      this.playTimer += dt * s.speed;
      if (this.playTimer > 12) {
        this.playTimer = 0;
        if (s.chapter >= this.chapters.length - 1) s.set({ playing: false });
        else s.set({ chapter: s.chapter + 1 });
      }
    }
    // art-directed sun: from the camera side for daylight, from behind for night
    const camDir = this.camera.position.clone().normalize();
    const side = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
    const sunDir = s.night ? camDir.clone().multiplyScalar(-1).addScaledVector(side, 0.9).normalize() : camDir.clone().addScaledVector(side, 0.6).setY(camDir.y + 0.35).normalize();
    this.sun.position.copy(sunDir).multiplyScalar(200);
    this.atmo?.setSun(sunDir);
    const em = this.globe.material as THREE.ShaderMaterial;
    if (em.uniforms?.uSunDir) {
      em.uniforms.uSunDir.value.copy(sunDir);
      // lights only after Pearl Street: none before 1880, growing to today
      const year = c?.year ?? 2026;
      em.uniforms.uNightBoost!.value = year < 1880 ? 0 : year < 1950 ? 0.25 : year < 2000 ? 0.7 : 1;
      em.uniforms.uCloudShift!.value = (this.time * 0.001) % 1;
    }
    if (this.clouds) {
      const cm = this.clouds.material as THREE.ShaderMaterial;
      cm.uniforms.uSunDir!.value.copy(sunDir);
      cm.uniforms.uShift!.value = (this.time * 0.001) % 1;
    }
    // markers: visited chapters glow, the current one pulses
    for (const m of this.markers.children) {
      const n = Number(m.name.replace('ring-', ''));
      const visited = n - 1 <= s.chapter;
      const current = n - 1 === s.chapter;
      m.visible = visited;
      if (m.name.startsWith('ring-')) m.scale.setScalar(current ? 1 + 0.25 * Math.sin(this.time * 4) : 0.7);
    }
    const entries: LabelEntry[] = this.chapters.map((ch, i) => ({ id: String(i), text: `${ch.n}`, color: '#ffd27a', priority: i === s.chapter ? 5 : 1, position: latLon(ch.lat, ch.lon, R * 1.008), radius: 0.05, visible: i <= s.chapter && i !== s.chapter }));
    this.labels.update(entries, this.camera, { center: new THREE.Vector3(), radius: R }, null);
    this.rig.update(dt);
    const el = this.ctx.renderer.canvas;
    el.dataset.chapter = String(s.chapter + 1);
    el.dataset.night = s.night ? 'true' : 'false';
  }

  zoom(factor: number): void {
    if (!this.ready) return;
    this.rig.cancelFlight();
    void this.rig.flyTo({ distance: this.rig.pose.distance * factor }, 0.6);
  }

  override commands(): Command[] {
    const s = civStore.getState();
    return [
      ...this.chapters.map((c, i) => ({ id: `ch:${c.id}`, label: `Chapter ${c.n}: ${c.title} (${c.when})`, group: 'Chapters', run: () => s.set({ chapter: i, playing: false }) })),
      { id: 'journey', label: 'Play the journey', group: 'Civilization', run: () => s.set({ chapter: 0, playing: true }) },
    ];
  }

  override unmount(): void {
    this.ready = false;
    this.unsub.forEach((u) => u());
    (this.rig as CameraRig | undefined)?.dispose();
    (this.labels as Labels | undefined)?.dispose();
    this.stars.dispose();
    this.atmo?.dispose();
    super.unmount();
  }
}
