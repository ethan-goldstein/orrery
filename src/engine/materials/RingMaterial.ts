import * as THREE from 'three';
import { shadowPars, shadowUniforms } from './shadows.glsl';

/** Ring geometry whose u runs radially from inner to outer edge. */
export function createRingGeometry(inner: number, outer: number, segments = 256): THREE.BufferGeometry {
  const geo = new THREE.RingGeometry(inner, outer, segments, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  uv.needsUpdate = true;
  geo.rotateX(-Math.PI / 2); // lie in the XZ plane, normal +Y
  return geo;
}

/**
 * Rings lit from either side with forward-scatter translucency, receiving
 * the planet's shadow analytically (so it survives the scale morph).
 */
export function createRingMaterial(map: THREE.Texture | null, color: string, opacity: number): THREE.ShaderMaterial & { shadowUniforms: ReturnType<typeof shadowUniforms> } {
  const uniforms = {
    uMap: { value: map },
    uHasMap: { value: map ? 1 : 0 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
    ...shadowUniforms(),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vWorldNormal;
      ${shadowPars}
      void main() {
        vec4 tex = uHasMap > 0.5 ? texture2D(uMap, vec2(vUv.x, 0.5)) : vec4(uColor, 1.0);
        float band = uHasMap > 0.5 ? 1.0 : (0.6 + 0.4 * sin(vUv.x * 60.0) * sin(vUv.x * 17.0));
        float alpha = tex.a * uOpacity * band;
        vec3 s = normalize(uSunPos - vWorldPos);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float nl = dot(vWorldNormal, s);
        float nv = dot(vWorldNormal, v);
        // lit face: direct; unlit face: light transmitted through the ring
        float sameSide = step(0.0, nl * nv);
        float direct = abs(nl) * sameSide;
        float transmitted = abs(nl) * (1.0 - sameSide) * 0.45 * (1.0 - alpha * 0.6);
        float shadow = sphereShadow(vWorldPos);
        vec3 col = tex.rgb * (0.04 + (direct + transmitted) * shadow * 1.35);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }) as THREE.ShaderMaterial & { shadowUniforms: ReturnType<typeof shadowUniforms> };
  mat.shadowUniforms = uniforms;
  return mat;
}
