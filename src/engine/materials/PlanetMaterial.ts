import * as THREE from 'three';
import { shadowPars, shadowUniforms } from './shadows.glsl';

export interface PlanetMaterialOptions {
  map?: THREE.Texture | null;
  color?: string;
  roughness?: number;
  /** procedural surface breakup for untextured moons */
  procedural?: boolean;
}

/**
 * Standard PBR planet surface with analytic eclipse and ring shadows injected
 * into three's lighting chain.
 */
export function createPlanetMaterial(opts: PlanetMaterialOptions): THREE.MeshStandardMaterial & { shadowUniforms: ReturnType<typeof shadowUniforms> } {
  const mat = new THREE.MeshStandardMaterial({
    map: opts.map ?? null,
    color: opts.map ? 0xffffff : new THREE.Color(opts.color ?? '#888888'),
    roughness: opts.roughness ?? 0.95,
    metalness: 0,
  }) as THREE.MeshStandardMaterial & { shadowUniforms: ReturnType<typeof shadowUniforms> };
  const uniforms = shadowUniforms();
  mat.shadowUniforms = uniforms;
  const procedural = !!opts.procedural;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vWorldPos; varying vec3 vObjNormal;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vObjNormal = normalize(objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n varying vec3 vWorldPos; varying vec3 vObjNormal;\n${shadowPars}\n
        float hash3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise3(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * noise3(p); p *= 2.1; a *= 0.5; } return s; }`)
      .replace(
        '#include <color_fragment>',
        procedural
          ? `#include <color_fragment>\n { float n = fbm3(vObjNormal * 6.0); float craters = smoothstep(0.55, 0.75, fbm3(vObjNormal * 14.0 + 3.0)); diffuseColor.rgb *= 0.78 + 0.34 * n - 0.18 * craters; }`
          : '#include <color_fragment>',
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>\n { float sh = sphereShadow(vWorldPos) * ringShadow(vWorldPos); reflectedLight.directDiffuse *= sh; reflectedLight.directSpecular *= sh; }`,
      );
  };
  mat.customProgramCacheKey = () => `planet-${procedural ? 'proc' : 'map'}`;
  return mat;
}
