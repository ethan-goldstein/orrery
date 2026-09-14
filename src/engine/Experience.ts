import * as THREE from 'three';
import type { Renderer } from './Renderer';
import type { Pose } from './CameraRig';
import type { ClockState } from '@/astro/time';

export interface ExperienceContext {
  renderer: Renderer;
  /** DOM element that receives pointer input and hosts labels */
  stage: HTMLElement;
  signal: AbortSignal;
}

export interface Command {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  run: () => void;
}

/**
 * Contract every page implements. The Engine mounts one at a time and drives
 * update(); Journey hands camera poses across experiences.
 */
export abstract class Experience {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 1e-4, 1e7);
  abstract readonly id: string;
  protected ctx!: ExperienceContext;

  async mount(ctx: ExperienceContext): Promise<void> {
    this.ctx = ctx;
  }

  abstract update(dt: number, clock: ClockState): void;

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  exportPose(): Pose | null {
    return null;
  }

  importPose(_pose: Pose): void {}

  commands(): Command[] {
    return [];
  }

  unmount(): void {
    disposeScene(this.scene);
  }
}

export function disposeScene(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else if (mat) disposeMaterial(mat);
  });
  root.clear();
}

function disposeMaterial(m: THREE.Material): void {
  for (const v of Object.values(m)) {
    if (v && typeof v === 'object' && 'isTexture' in v) (v as THREE.Texture).dispose();
  }
  m.dispose();
}
