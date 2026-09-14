import * as THREE from 'three';
import { TIERS, type Tier, type TierName } from './QualityTier';

export type FrameCallback = (dt: number, elapsed: number) => void;

export interface RendererEvents {
  contextlost: () => void;
  contextrestored: () => void;
}

/**
 * Owns the single WebGL2 context for the whole site, the animation loop,
 * resize handling, DPR capping and context-loss recovery.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: THREE.WebGLRenderer;
  tier: Tier;
  private raf = 0;
  private running = false;
  private lastTime = 0;
  private elapsed = 0;
  private readonly frameCallbacks = new Set<FrameCallback>();
  private readonly listeners: { [K in keyof RendererEvents]: Set<RendererEvents[K]> } = {
    contextlost: new Set(),
    contextrestored: new Set(),
  };
  private readonly onVisibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
  private pausedByVisibility = false;
  private readonly resizeObserver: ResizeObserver;

  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  constructor(readonly container: HTMLElement, tierName: TierName) {
    this.tier = TIERS[tierName];
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'orrery-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.renderer = 'booting';
    container.prepend(this.canvas);
    this.gl = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
      stencil: false,
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping; // the composer tone-maps
    this.gl.setClearColor(0x04060b, 1);
    this.applyTier(tierName);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.canvas.dataset.renderer = 'lost';
      this.pause();
      this.listeners.contextlost.forEach((f) => f());
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.canvas.dataset.renderer = 'ready';
      this.resume();
      this.listeners.contextrestored.forEach((f) => f());
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  applyTier(name: TierName): void {
    this.tier = TIERS[name];
    const dpr = Math.min(window.devicePixelRatio || 1, this.tier.dprCap, 2);
    this.gl.setPixelRatio(dpr);
    this.canvas.dataset.dpr = dpr.toFixed(2);
    this.canvas.dataset.quality = name;
    this.resize();
  }

  get size(): { width: number; height: number } {
    return { width: this.container.clientWidth, height: this.container.clientHeight };
  }

  resize(): void {
    const { width, height } = this.size;
    if (width === 0 || height === 0) return;
    this.gl.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.resizeCallbacks.forEach((f) => f(width, height));
  }

  private readonly resizeCallbacks = new Set<(w: number, h: number) => void>();
  onResize(cb: (w: number, h: number) => void): () => void {
    this.resizeCallbacks.add(cb);
    return () => this.resizeCallbacks.delete(cb);
  }

  onFrame(cb: FrameCallback): () => void {
    this.frameCallbacks.add(cb);
    return () => this.frameCallbacks.delete(cb);
  }

  on<K extends keyof RendererEvents>(event: K, cb: RendererEvents[K]): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.canvas.dataset.renderer = 'ready';
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.elapsed += dt;
      this.frameCallbacks.forEach((f) => f(dt, this.elapsed));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.pausedByVisibility = document.hidden;
    cancelAnimationFrame(this.raf);
  }

  resume(): void {
    if (this.running) return;
    if (this.canvas.dataset.renderer === 'lost') return;
    this.pausedByVisibility = false;
    this.start();
  }

  dispose(): void {
    this.pause();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.frameCallbacks.clear();
    this.gl.dispose();
    this.canvas.remove();
  }
}
