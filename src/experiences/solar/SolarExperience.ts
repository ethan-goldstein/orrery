import * as THREE from 'three';
import { Experience, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { CameraRig } from '@/engine/CameraRig';
import type { ClockState } from '@/astro/time';

/**
 * Phase 0 stub: proves the render path (log depth + bloom + SMAA), the
 * starfield and the camera rig. Phase 1 replaces the bodies with real ones.
 */
export class SolarExperience extends Experience {
  readonly id = 'solar';
  private stars = new Starfield();
  private rig: CameraRig | null = null;
  private planet!: THREE.Mesh;
  private sun!: THREE.Mesh;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    this.scene.add(this.stars.points);
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());

    const segs = ctx.renderer.tier.sphereSegments;
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, segs, segs / 2),
      new THREE.MeshStandardMaterial({ color: 0x3d6fb5, roughness: 0.85, metalness: 0 }),
    );
    this.planet.name = 'stub-planet';
    this.scene.add(this.planet);

    // Emissive > 1 so bloom picks it up through the ACES pass.
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 48, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.6).multiplyScalar(6) }),
    );
    this.sun.position.set(14, 3, -6);
    this.sun.name = 'stub-sun';
    this.scene.add(this.sun);

    const light = new THREE.PointLight(0xfff2dc, 900, 0, 2);
    light.position.copy(this.sun.position);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x243044, 0.35));

    this.rig = new CameraRig(this.camera, ctx.stage, { distance: 5, phi: 1.25, theta: 0.5 });
    this.rig.limits = { ...this.rig.limits, minDistance: 1.6, maxDistance: 60 };
    await this.stars.load(ctx.signal);
  }

  update(dt: number, clock: ClockState): void {
    this.planet.rotation.y = (clock.epochMs / 86_400_000) * Math.PI * 2;
    this.rig?.update(dt);
  }

  override unmount(): void {
    this.rig?.dispose();
    this.stars.dispose();
    super.unmount();
  }
}
