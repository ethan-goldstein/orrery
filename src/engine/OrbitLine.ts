import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/** Fat screen-space line for orbit guides and trails. */
export class OrbitLine {
  readonly line: Line2;
  readonly material: LineMaterial;
  private geometry: LineGeometry;
  private capacity = 0;

  constructor(color: string, opacity = 0.5, width = 1.2) {
    this.material = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthWrite: false, worldUnits: false });
    this.geometry = new LineGeometry();
    this.line = new Line2(this.geometry, this.material);
    this.line.frustumCulled = false;
    this.line.renderOrder = 1;
  }

  setPoints(points: ArrayLike<number>): void {
    const n = points.length / 3;
    if (n < 2) {
      this.line.visible = false;
      return;
    }
    this.line.visible = true;
    if (n !== this.capacity) {
      this.geometry.dispose();
      this.geometry = new LineGeometry();
      this.line.geometry = this.geometry;
      this.capacity = n;
    }
    this.geometry.setPositions(Array.from(points));
    this.line.computeLineDistances();
  }

  setResolution(w: number, h: number): void {
    this.material.resolution.set(w, h);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
