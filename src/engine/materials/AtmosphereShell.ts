import * as THREE from 'three';
import { applyLogDepth } from './logDepth';

/**
 * Two additive shells: an inner front-facing haze that brightens the day limb
 * and an outer back-facing halo. Colour warms into a twilight band along the
 * terminator, so sunsets read as orange rims rather than a hard edge.
 */
export function createAtmosphereShells(color: string, twilight: string | undefined, thickness: number, sharedGeometry?: THREE.SphereGeometry): { inner: THREE.Mesh; outer: THREE.Mesh; setSun: (dir: THREE.Vector3) => void; dispose: () => void } {
  const uniforms = () => ({
    uColor: { value: new THREE.Color(color) },
    uTwilight: { value: new THREE.Color(twilight ?? color) },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uPower: { value: 4.0 },
    uAlpha: { value: 0.5 },
  });
  const vertex = /* glsl */ `
    varying vec3 vNormal; varying vec3 vView; varying vec3 vWorldNormal;
    void main() {
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const fragment = (back: boolean) => /* glsl */ `
    uniform vec3 uColor; uniform vec3 uTwilight; uniform vec3 uSunDir; uniform float uPower; uniform float uAlpha;
    varying vec3 vNormal; varying vec3 vView; varying vec3 vWorldNormal;
    void main() {
      float ndv = ${back ? '-' : ''}dot(normalize(vNormal), normalize(vView));
      float rim = pow(clamp(1.0 - ${back ? '-' : ''}ndv, 0.0, 1.0), uPower);
      ${back ? 'rim = pow(clamp(1.0 + ndv, 0.0, 1.0), uPower);' : ''}
      float lit = dot(normalize(vWorldNormal), normalize(uSunDir));
      float day = smoothstep(-0.35, 0.6, lit);
      float twilight = exp(-pow(lit * 3.2, 2.0));
      vec3 col = mix(uColor * 0.55, uColor, day);
      col = mix(col, uTwilight, twilight * 0.55);
      float a = rim * uAlpha * (0.12 + 0.88 * max(day, twilight * 0.6));
      gl_FragColor = vec4(col * a * 1.6, a);
    }`;
  const uIn = uniforms();
  const uOut = uniforms();
  uOut.uPower.value = 5.5;
  uOut.uAlpha.value = 0.38;
  const geo = sharedGeometry ?? new THREE.SphereGeometry(1, 96, 64);
  const ownsGeometry = !sharedGeometry;
  const inner = new THREE.Mesh(geo, applyLogDepth(new THREE.ShaderMaterial({ uniforms: uIn, vertexShader: vertex, fragmentShader: fragment(false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide })));
  const outer = new THREE.Mesh(geo, applyLogDepth(new THREE.ShaderMaterial({ uniforms: uOut, vertexShader: vertex, fragmentShader: fragment(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide })));
  inner.scale.setScalar(1 + thickness * 0.35);
  outer.scale.setScalar(1 + thickness * 2.2);
  inner.renderOrder = 2;
  outer.renderOrder = 3;
  return {
    inner,
    outer,
    setSun: (dir) => {
      uIn.uSunDir.value.copy(dir);
      uOut.uSunDir.value.copy(dir);
    },
    dispose: () => {
      if (ownsGeometry) geo.dispose();
      (inner.material as THREE.Material).dispose();
      (outer.material as THREE.Material).dispose();
    },
  };
}
