import * as THREE from 'three';
import { OBLIQUITY_J2000_DEG } from '@/astro/frames';

/**
 * Equirectangular Milky Way panorama (equatorial J2000, RA along u) drawn at
 * the far plane with the same translation-free projection as the star points,
 * so it sits behind the catalog stars and never parallaxes.
 */
export class MilkyWay {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(map: THREE.Texture, intensity = 0.55) {
    // scene -> EQJ: undo (x, z, -y) then rotate about +x by +obliquity
    const eps = (OBLIQUITY_J2000_DEG * Math.PI) / 180;
    const eclToEqj = new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(eps), -Math.sin(eps), 0, Math.sin(eps), Math.cos(eps));
    const sceneToEcl = new THREE.Matrix3().set(1, 0, 0, 0, 0, -1, 0, 1, 0); // scene (x, y, z) -> ecl (x, -z, y)
    const sceneToEqj = new THREE.Matrix3().multiplyMatrices(eclToEqj, sceneToEcl);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uIntensity: { value: intensity }, uSceneToEqj: { value: sceneToEqj } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec3 dir = normalize(mat3(viewMatrix) * position);
          vec4 clip = projectionMatrix * vec4(dir * 100.0, 1.0);
          gl_Position = clip.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uIntensity; uniform mat3 uSceneToEqj;
        varying vec3 vDir;
        void main() {
          vec3 e = normalize(uSceneToEqj * vDir);
          float ra = atan(e.y, e.x);
          float dec = asin(clamp(e.z, -1.0, 1.0));
          vec2 uv = vec2(0.5 + ra / 6.2831853, 0.5 + dec / 3.1415926);
          vec3 c = texture2D(uMap, uv).rgb;
          gl_FragColor = vec4(c * uIntensity, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      side: THREE.BackSide,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -110;
    this.mesh.name = 'milky-way';
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
