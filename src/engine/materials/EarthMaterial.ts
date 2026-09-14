import * as THREE from 'three';
import { shadowPars, shadowUniforms } from './shadows.glsl';
import { applyLogDepth } from './logDepth';

export interface EarthMaps {
  day: THREE.Texture;
  night: THREE.Texture | null;
  normal: THREE.Texture | null;
  specular: THREE.Texture | null;
  clouds: THREE.Texture | null;
}

/**
 * Earth surface: day/night blend across a soft terminator, city lights,
 * normal-mapped relief, sun glint on water, cloud shadows offset toward the
 * sun, and rim scattering. Analytic eclipse shadows from the Moon.
 */
export function createEarthMaterial(maps: EarthMaps): THREE.ShaderMaterial & { shadowUniforms: ReturnType<typeof shadowUniforms> } {
  const uniforms = {
    uDay: { value: maps.day },
    uNight: { value: maps.night },
    uNormal: { value: maps.normal },
    uSpecular: { value: maps.specular },
    uClouds: { value: maps.clouds },
    uHasNight: { value: maps.night ? 1 : 0 },
    uHasNormal: { value: maps.normal ? 1 : 0 },
    uHasSpecular: { value: maps.specular ? 1 : 0 },
    uHasClouds: { value: maps.clouds ? 1 : 0 },
    uCloudShift: { value: 0 },
    uCloudOpacity: { value: 1 },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunIntensity: { value: 2.6 },
    uAtmoColor: { value: new THREE.Color('#6fb1ff') },
    uNightBoost: { value: 1 },
    ...shadowUniforms(),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vWorldPos; varying vec3 vObjPos;
      void main() {
        vUv = uv; vObjPos = position;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay, uNight, uNormal, uSpecular, uClouds;
      uniform float uHasNight, uHasNormal, uHasSpecular, uHasClouds, uCloudShift, uCloudOpacity, uSunIntensity, uNightBoost;
      uniform vec3 uSunDir; uniform vec3 uAtmoColor;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vWorldPos; varying vec3 vObjPos;
      ${shadowPars}
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);
        // tangent frame from the sphere parametrisation (east, north)
        vec3 objN = normalize(vObjPos);
        vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), objN));
        vec3 B = cross(objN, T);
        vec3 Nn = N;
        if (uHasNormal > 0.5) {
          vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
          nm.xy *= 0.9;
          vec3 objPerturbed = normalize(T * nm.x + B * nm.y + objN * nm.z);
          // rotate perturbed object normal into world using the same transform as the geometric normal
          Nn = normalize(N + (objPerturbed - objN) * 1.0);
        }
        vec3 day = texture2D(uDay, vUv).rgb;
        float water = uHasSpecular > 0.5 ? texture2D(uSpecular, vUv).r : 0.0;
        float ndl = dot(Nn, L);
        float ndlGeo = dot(N, L);
        float daylight = smoothstep(-0.08, 0.25, ndlGeo);
        float shadow = sphereShadow(vWorldPos);
        float diffuse = max(ndl, 0.0) * shadow;
        // cloud shadow: sample the cloud map displaced toward the sun in tangent space
        float cloudShadow = 1.0;
        float cloudsHere = 0.0;
        if (uHasClouds > 0.5) {
          vec2 sunT = vec2(dot(L, T), dot(L, B)) * 0.008;
          vec2 cuv = vec2(fract(vUv.x + uCloudShift + sunT.x), clamp(vUv.y + sunT.y, 0.0, 1.0));
          float c = texture2D(uClouds, cuv).r * uCloudOpacity;
          cloudShadow = 1.0 - c * 0.55 * daylight;
          cloudsHere = texture2D(uClouds, vec2(fract(vUv.x + uCloudShift), vUv.y)).r * uCloudOpacity;
        }
        vec3 col = day * diffuse * uSunIntensity * cloudShadow;
        // sun glint on water
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(Nn, H), 0.0), 90.0) * water * shadow * daylight;
        col += vec3(1.0, 0.95, 0.85) * spec * 1.6 * (1.0 - cloudsHere * 0.8);
        // night side
        if (uHasNight > 0.5) {
          vec3 night = texture2D(uNight, vUv).rgb;
          float warmth = clamp((night.r - night.b) * 3.0 + 0.2, 0.0, 1.0);
          vec3 lights = night * (0.6 + 0.9 * warmth) * vec3(1.0, 0.82, 0.55);
          float nightMask = 1.0 - smoothstep(-0.2, 0.1, ndlGeo);
          col += lights * nightMask * 1.8 * uNightBoost * (1.0 - cloudsHere * 0.7);
          // faint earthshine/skyglow so geography stays readable
          col += day * 0.012 * nightMask;
        }
        // rim scattering
        float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float twilight = exp(-pow(ndlGeo * 3.0, 2.0));
        vec3 rimCol = mix(uAtmoColor, vec3(1.0, 0.45, 0.2), twilight * 0.6);
        col += rimCol * rim * (0.25 + 0.75 * daylight) * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }) as THREE.ShaderMaterial & { shadowUniforms: ReturnType<typeof shadowUniforms> };
  mat.shadowUniforms = uniforms;
  applyLogDepth(mat);
  return mat;
}

/** Separate cloud sphere slightly above the surface. */
export function createCloudMaterial(clouds: THREE.Texture): THREE.ShaderMaterial {
  return applyLogDepth(new THREE.ShaderMaterial({
    uniforms: {
      uClouds: { value: clouds },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uShift: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vView;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uClouds; uniform vec3 uSunDir; uniform float uShift; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vView;
      void main() {
        float c = texture2D(uClouds, vec2(fract(vUv.x + uShift), vUv.y)).r;
        float ndl = dot(normalize(vNormalW), normalize(uSunDir));
        float lit = smoothstep(-0.15, 0.3, ndl);
        float twilight = exp(-pow(ndl * 3.0, 2.0));
        vec3 col = mix(vec3(0.035, 0.05, 0.09), vec3(1.0), lit) * 2.2;
        col = mix(col, vec3(1.0, 0.6, 0.4) * 1.6, twilight * 0.35 * lit);
        gl_FragColor = vec4(col, c * uOpacity * (0.35 + 0.65 * lit + 0.25));
      }`,
    transparent: true,
    depthWrite: false,
  }));
}
