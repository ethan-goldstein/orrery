import * as THREE from 'three';
import { assetUrl } from './Assets';

/**
 * HYG catalog stars drawn at the far plane with a translation-free
 * projection, so the sky never parallaxes no matter how far the camera
 * travels. Depth test is off and the field renders first, so every scene
 * object overdraws it.
 *
 * Binary layout (Float32 x 5 per star): sx, sy, sz (scene-frame unit vector),
 * visual magnitude, B-V color index. Produced by scripts/fetch-hyg.ts.
 */
export class Starfield {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  count = 0;

  constructor(private readonly cap = 9000) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uIntensity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vAlpha = clamp(size / 2.5, 0.25, 1.0);
          vec3 dir = normalize(mat3(viewMatrix) * position);
          vec4 clip = projectionMatrix * vec4(dir * 100.0, 1.0);
          gl_Position = clip.xyww;
          gl_PointSize = max(1.0, size * uPixelRatio);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uIntensity;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float core = smoothstep(1.0, 0.15, d);
          float halo = exp(-d * d * 3.0) * 0.35;
          float a = (core + halo) * vAlpha * uIntensity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * a, a);
        }
      `,
      // Not flagged transparent on purpose: that would push the stars into the
      // late transparent pass and draw them over every opaque body. Additive
      // blending still applies; renderOrder -100 draws the sky first.
      transparent: false,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(new THREE.BufferGeometry(), this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -100;
    this.points.name = 'starfield';
  }

  async load(signal?: AbortSignal): Promise<void> {
    const res = await fetch(assetUrl('data/stars/hyg.bin'), { signal });
    if (!res.ok) throw new Error(`Starfield: ${res.status} loading catalog`);
    const buf = await res.arrayBuffer();
    this.setData(new Float32Array(buf));
  }

  setData(data: Float32Array): void {
    const stride = 5;
    const total = Math.floor(data.length / stride);
    const n = Math.min(total, this.cap);
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * stride;
      positions[i * 3] = data[o]!;
      positions[i * 3 + 1] = data[o + 1]!;
      positions[i * 3 + 2] = data[o + 2]!;
      const mag = data[o + 3]!;
      const bv = data[o + 4]!;
      const [r, g, b] = bvToRgb(bv);
      // magnitude -> apparent brightness, compressed for display
      const brightness = Math.min(1, Math.pow(10, -0.4 * (mag - 1.5)));
      const size = 1.2 + 3.2 * Math.pow(brightness, 0.45);
      colors[i * 3] = r * (0.4 + 0.6 * Math.pow(brightness, 0.5));
      colors[i * 3 + 1] = g * (0.4 + 0.6 * Math.pow(brightness, 0.5));
      colors[i * 3 + 2] = b * (0.4 + 0.6 * Math.pow(brightness, 0.5));
      sizes[i] = size;
    }
    const geo = this.points.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.count = n;
  }

  setPixelRatio(dpr: number): void {
    this.material.uniforms.uPixelRatio!.value = dpr;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/** Approximate blackbody color from B-V (Ballesteros' formula for T, then a fitted RGB curve). */
export function bvToRgb(bv: number): [number, number, number] {
  const b = Math.min(2.0, Math.max(-0.4, bv));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const x = t / 100;
  const r = x <= 66 ? 255 : 329.698727446 * Math.pow(x - 60, -0.1332047592);
  const g = x <= 66 ? 99.4708025861 * Math.log(x) - 161.1195681661 : 288.1221695283 * Math.pow(x - 60, -0.0755148492);
  const bl = x >= 66 ? 255 : x <= 19 ? 0 : 138.5177312231 * Math.log(x - 10) - 305.0447927307;
  const c = (v: number) => Math.min(1, Math.max(0, v / 255));
  return [c(r), c(g), c(bl)];
}
