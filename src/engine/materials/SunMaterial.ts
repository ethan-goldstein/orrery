import * as THREE from 'three';
import { applyLogDepth } from './logDepth';

/**
 * Photosphere: texture modulated by animated granulation noise, limb
 * darkening, output above 1.0 so the bloom pass catches it.
 */
export function createSunMaterial(map: THREE.Texture | null): THREE.ShaderMaterial {
  return applyLogDepth(new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uTime: { value: 0 },
      uIntensity: { value: 4.5 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vObj;
      void main() {
        vUv = uv; vObj = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uHasMap; uniform float uTime; uniform float uIntensity;
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vObj;
      float hash3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise3(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * noise3(p); p = p * 2.02 + 0.3; a *= 0.5; } return s; }
      void main() {
        vec3 p = normalize(vObj);
        float t = uTime * 0.02;
        float g = fbm(p * 18.0 + vec3(t, -t * 0.7, t * 0.4));
        float g2 = fbm(p * 46.0 - vec3(t * 1.3, t, -t * 0.5));
        float gran = 0.72 + 0.42 * g + 0.18 * (g2 - 0.5);
        vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : vec3(1.0, 0.72, 0.35);
        vec3 col = mix(base, vec3(1.0, 0.86, 0.55), 0.35) * gran;
        float mu = max(dot(normalize(vNormal), normalize(vView)), 0.0);
        float limb = 0.42 + 0.58 * pow(mu, 0.55); // limb darkening
        col *= limb;
        // hot spots
        col += vec3(1.0, 0.9, 0.7) * smoothstep(0.62, 0.9, g2) * 0.35;
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }`,
  }));
}

/** Additive radial-gradient corona sprite, several radii wide. */
export function createCoronaSprite(): THREE.Sprite {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,244,214,0.95)');
  g.addColorStop(0.12, 'rgba(255,224,160,0.55)');
  g.addColorStop(0.3, 'rgba(255,190,110,0.18)');
  g.addColorStop(0.6, 'rgba(255,150,80,0.05)');
  g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 5;
  return sprite;
}
