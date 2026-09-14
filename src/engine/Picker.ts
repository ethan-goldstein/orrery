import * as THREE from 'three';

export interface Pickable {
  id: string;
  position: THREE.Vector3;
  /** display radius in scene units */
  radius: number;
  visible: boolean;
}

const tmp = new THREE.Vector3();

/**
 * Screen-space picking: a click within max(projected radius, 16 px) of a
 * body's centre selects it. Robust for pixel-sized bodies where raycasting
 * against the sphere would never hit.
 */
export class Picker {
  private down: { x: number; y: number; id: number } | null = null;
  onPick: ((id: string | null) => void) | null = null;
  private disposers: (() => void)[] = [];

  constructor(private readonly element: HTMLElement, private readonly camera: THREE.PerspectiveCamera, private readonly bodies: () => Pickable[]) {
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      this.down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const up = (e: PointerEvent) => {
      if (!this.down || this.down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved > 5) return;
      this.onPick?.(this.pick(e.clientX, e.clientY));
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointerup', up);
    this.disposers.push(() => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointerup', up);
    });
  }

  pick(clientX: number, clientY: number): string | null {
    const rect = this.element.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best: { id: string; d: number } | null = null;
    const fovScale = rect.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    for (const b of this.bodies()) {
      if (!b.visible) continue;
      tmp.copy(b.position);
      const dist = tmp.distanceTo(this.camera.position);
      tmp.project(this.camera);
      if (tmp.z > 1) continue;
      const x = (tmp.x * 0.5 + 0.5) * rect.width;
      const y = (-tmp.y * 0.5 + 0.5) * rect.height;
      const projectedRadius = (b.radius / dist) * fovScale;
      const hit = Math.max(projectedRadius, 16);
      const d = Math.hypot(px - x, py - y);
      if (d <= hit && (!best || d < best.d)) best = { id: b.id, d };
    }
    return best?.id ?? null;
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
  }
}
