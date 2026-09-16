import { Experience, type ExperienceContext } from '@/engine/Experience';
import { Starfield } from '@/engine/Starfield';
import { CameraRig } from '@/engine/CameraRig';
import type { ClockState } from '@/astro/time';

/** Just the sky. Used by the landing page and by pages not yet built. */
export class SkyExperience extends Experience {
  readonly id = 'sky';
  private stars = new Starfield();
  private rig: CameraRig | null = null;
  private drift = 0;

  override async mount(ctx: ExperienceContext): Promise<void> {
    await super.mount(ctx);
    this.scene.add(this.stars.points);
    this.stars.setPixelRatio(ctx.renderer.gl.getPixelRatio());
    this.rig = new CameraRig(this.camera, ctx.stage, { distance: 10, phi: 1.35, theta: 0.2 });
    this.rig.limits = { ...this.rig.limits, minDistance: 10, maxDistance: 10 };
    await this.stars.load(ctx.signal);
  }

  update(dt: number): void {
    this.drift += dt * 0.004;
    if (this.rig && !this.rig.flying) this.rig.goal.theta += dt * 0.004;
    this.rig?.update(dt);
  }

  override unmount(): void {
    this.rig?.dispose();
    this.stars.dispose();
    super.unmount();
  }
}

export type { ClockState };
