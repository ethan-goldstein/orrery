import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';
import type { Tier } from './QualityTier';

export interface ComposerOptions {
  grain: boolean;
  vignette: boolean;
}

/**
 * Render -> Bloom -> ACES tone mapping -> Grain/Vignette -> SMAA.
 * Nothing here reads the depth buffer, which keeps it compatible with the
 * logarithmic depth buffer used for solar-system scale ranges.
 */
export class Composer {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: BloomEffect;
  private grain: NoiseEffect;
  private vignette: VignetteEffect;
  private effectPass: EffectPass;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    private tier: Tier,
    private options: ComposerOptions = { grain: false, vignette: true },
  ) {
    this.scene = scene;
    this.camera = camera;
    this.composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new BloomEffect({
      luminanceThreshold: 1.0,
      luminanceSmoothing: 0.2,
      intensity: 1.1,
      mipmapBlur: true,
      radius: 0.6,
    });
    this.grain = new NoiseEffect({ blendFunction: BlendFunction.COLOR_DODGE, premultiply: true });
    this.grain.blendMode.opacity.value = 0.045;
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    this.effectPass = this.buildEffectPass();
    this.composer.addPass(this.effectPass);
  }

  private buildEffectPass(): EffectPass {
    const effects = [];
    if (this.tier.bloom) effects.push(this.bloom);
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if (this.options.grain) effects.push(this.grain);
    if (this.options.vignette) effects.push(this.vignette);
    if (this.tier.smaa) effects.push(new SMAAEffect({ preset: SMAAPreset.HIGH }));
    const pass = new EffectPass(this.camera, ...effects);
    return pass;
  }

  setScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this.scene = scene;
    this.camera = camera;
    this.renderPass.mainScene = scene;
    this.renderPass.mainCamera = camera;
    this.effectPass.mainCamera = camera;
  }

  configure(tier: Tier, options: Partial<ComposerOptions>): void {
    this.tier = tier;
    this.options = { ...this.options, ...options };
    this.composer.removePass(this.effectPass);
    this.effectPass.dispose();
    this.effectPass = this.buildEffectPass();
    this.composer.addPass(this.effectPass);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
