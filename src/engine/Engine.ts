import { Renderer } from './Renderer';
import { Composer } from './Composer';
import { Experience } from './Experience';
import { probeFromBrowser, type TierName } from './QualityTier';
import { settingsStore } from '@/store/settings';
import { clockStore } from '@/store/clock';
import { advance } from '@/astro/time';
import { experienceStore } from '@/store/experience';

export type ExperienceFactory = () => Experience;

/**
 * One engine per page load. Owns the renderer and composer and swaps
 * experiences as routes change.
 */
export class Engine {
  readonly renderer: Renderer;
  private composer: Composer | null = null;
  private current: Experience | null = null;
  private abort: AbortController | null = null;
  private lastClockTick = performance.now();
  private unsubscribers: (() => void)[] = [];
  private compiling = false;

  constructor(readonly container: HTMLElement, readonly stage: HTMLElement) {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    const probed: TierName = gl ? probeFromBrowser(gl) : 'low';
    const override = settingsStore.getState().quality;
    const tier = override === 'auto' ? probed : override;
    settingsStore.getState().setProbedQuality(probed);
    this.renderer = new Renderer(container, tier);
    this.unsubscribers.push(
      this.renderer.onFrame((dt) => this.frame(dt)),
      this.renderer.onResize((w, h) => {
        this.current?.resize(w, h);
        this.composer?.setSize(w, h);
      }),
      settingsStore.subscribe((s, prev) => {
        if (s.quality !== prev.quality || s.grain !== prev.grain) {
          const t = s.quality === 'auto' ? s.probedQuality : s.quality;
          this.renderer.applyTier(t);
          this.composer?.configure(this.renderer.tier, { grain: s.grain });
        }
      }),
    );
    this.renderer.start();
  }

  async mount(factory: ExperienceFactory): Promise<Experience> {
    this.unmount();
    const abort = new AbortController();
    this.abort = abort;
    const exp = factory();
    this.current = exp;
    const { width, height } = this.renderer.size;
    exp.resize(width || 1, height || 1);
    if (!this.composer) {
      this.composer = new Composer(this.renderer.gl, exp.scene, exp.camera, this.renderer.tier, {
        grain: settingsStore.getState().grain,
        vignette: true,
      });
      this.composer.setSize(width || 1, height || 1);
    } else {
      this.composer.setScene(exp.scene, exp.camera);
    }
    this.renderer.canvas.dataset.experience = exp.id;
    this.renderer.canvas.dataset.experienceState = 'loading';
    try {
      await exp.mount({ renderer: this.renderer, stage: this.stage, signal: abort.signal });
      // parallel shader compilation keeps the first frames off the main thread's critical path
      if (!abort.signal.aborted) {
        this.compiling = true;
        try {
          await this.renderer.gl.compileAsync(exp.scene, exp.camera);
        } catch {
          /* fall back to synchronous compile on first render */
        }
        this.compiling = false;
      }
      if (!abort.signal.aborted) {
        this.renderer.canvas.dataset.experienceState = 'ready';
        experienceStore.getState().set({ commands: exp.commands() });
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        this.renderer.canvas.dataset.experienceState = 'error';
        console.error(`[orrery] ${exp.id} failed to load`, err);
      }
    }
    return exp;
  }

  unmount(): void {
    this.abort?.abort();
    this.abort = null;
    if (this.current) {
      this.current.unmount();
      this.current = null;
      experienceStore.getState().set({ commands: [] });
    }
  }

  private frame(dt: number): void {
    const now = performance.now();
    const realDt = (now - this.lastClockTick) / 1000;
    this.lastClockTick = now;
    const clock = clockStore.getState();
    const next = advance(clock, realDt);
    if (next !== clock) clockStore.setState(next);
    if (!this.current || !this.composer) return;
    this.current.update(dt, next);
    if (this.compiling) return;
    this.composer.render(dt);
  }

  dispose(): void {
    this.unmount();
    this.unsubscribers.forEach((u) => u());
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
