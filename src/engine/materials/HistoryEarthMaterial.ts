import * as THREE from 'three';

/**
 * Deep-time Earth. Blends two 8-bit PaleoDEM height frames by age, shades
 * land hypsometrically with relief lighting from finite differences, floods
 * below a sea level offset, adds ice fronts and a molten Hadean look, and
 * cross-fades to the photographic day map in the last few million years.
 *
 * Height frames encode metres as (value / 255) * 20000 - 12000.
 */
export function createHistoryEarthMaterial(opts: { day: THREE.Texture; night: THREE.Texture | null; clouds: THREE.Texture | null; specular: THREE.Texture | null }): THREE.ShaderMaterial {
  const empty = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  empty.needsUpdate = true;
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: opts.day },
      uNight: { value: opts.night },
      uHasNight: { value: opts.night ? 1 : 0 },
      uClouds: { value: opts.clouds },
      uHasClouds: { value: opts.clouds ? 1 : 0 },
      uSpecular: { value: opts.specular },
      uHasSpecular: { value: opts.specular ? 1 : 0 },
      uFrameA: { value: empty },
      uFrameB: { value: empty },
      uFrameMix: { value: 0 },
      uHasFrames: { value: 0 },
      /** 0 = fully reconstructed terrain, 1 = photographic */
      uPhoto: { value: 1 },
      uHeat: { value: 0 },
      uIce: { value: 0 },
      uSeaLevel: { value: 0 },
      uCloudShift: { value: 0 },
      uCloudOpacity: { value: 1 },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunIntensity: { value: 2.4 },
      uNightMode: { value: 0 },
      uBlueHour: { value: 0 },
      uCompare: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / 3600, 1 / 1800) },
      uTime: { value: 0 },
    },
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
      uniform sampler2D uDay, uNight, uClouds, uSpecular, uFrameA, uFrameB;
      uniform float uHasNight, uHasClouds, uHasSpecular, uFrameMix, uHasFrames, uPhoto, uHeat, uIce, uSeaLevel, uCloudShift, uCloudOpacity, uSunIntensity, uNightMode, uBlueHour, uCompare, uTime;
      uniform vec3 uSunDir; uniform vec2 uTexel;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vWorldPos; varying vec3 vObjPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }

      float height(vec2 uv) {
        float a = texture2D(uFrameA, uv).r;
        float b = texture2D(uFrameB, uv).r;
        float h = mix(a, b, uFrameMix) * 20000.0 - 12000.0;
        // high-frequency crust detail so 6-arcminute cells read as terrain
        h += (fbm(uv * vec2(180.0, 90.0)) - 0.5) * 600.0 * smoothstep(-500.0, 800.0, h);
        return h;
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 objN = normalize(vObjPos);
        vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), objN));
        vec3 B = cross(objN, T);

        vec3 photo = texture2D(uDay, vUv).rgb;
        float water = uHasSpecular > 0.5 ? texture2D(uSpecular, vUv).r : 0.0;

        // ---- reconstructed terrain ----
        vec3 terrain = photo;
        float land = 1.0 - water;
        vec3 Nn = N;
        if (uHasFrames > 0.5) {
          float h = height(vUv) - uSeaLevel;
          float hx = height(vUv + vec2(uTexel.x, 0.0)) - height(vUv - vec2(uTexel.x, 0.0));
          float hy = height(vUv + vec2(0.0, uTexel.y)) - height(vUv - vec2(0.0, uTexel.y));
          land = smoothstep(-15.0, 25.0, h);
          float depth = max(0.0, -h);
          vec3 deep = vec3(0.02, 0.10, 0.22);
          vec3 shelf = vec3(0.10, 0.36, 0.46);
          vec3 ocean = mix(shelf, deep, 1.0 - exp(-depth / 900.0));
          float alt = clamp(h / 3500.0, 0.0, 1.0);
          float lat = abs(vUv.y - 0.5) * 2.0;
          vec3 lowland = mix(vec3(0.22, 0.36, 0.16), vec3(0.55, 0.48, 0.28), smoothstep(0.0, 0.45, alt));
          vec3 highland = mix(vec3(0.5, 0.42, 0.3), vec3(0.8, 0.78, 0.74), smoothstep(0.35, 1.0, alt));
          vec3 landCol = mix(lowland, highland, smoothstep(0.25, 0.7, alt));
          // deserts around 20-30 degrees, tundra toward the poles
          landCol = mix(landCol, vec3(0.72, 0.6, 0.38), smoothstep(0.25, 0.4, lat) * (1.0 - smoothstep(0.42, 0.55, lat)) * 0.45 * (1.0 - alt));
          landCol = mix(landCol, vec3(0.6, 0.62, 0.58), smoothstep(0.7, 0.95, lat) * 0.6);
          // relief shading from slopes (tangent-space normal)
          vec3 slopeN = normalize(vec3(-hx * 0.00035, -hy * 0.00035, 1.0));
          Nn = normalize(T * slopeN.x + B * slopeN.y + objN * slopeN.z);
          Nn = normalize(N + (Nn - objN));
          terrain = mix(ocean, landCol, land);
          // ice: latitude front with noisy edge
          float iceLat = mix(0.98, 0.05, uIce);
          float iceEdge = smoothstep(iceLat - 0.08, iceLat + 0.04, lat + (fbm(vUv * 40.0) - 0.5) * 0.1);
          terrain = mix(terrain, vec3(0.82, 0.87, 0.92), iceEdge * (0.6 + 0.4 * land));
          // molten Hadean
          float glow = fbm(vUv * vec2(60.0, 30.0) + uTime * 0.01);
          vec3 magma = mix(vec3(0.08, 0.02, 0.01), vec3(1.0, 0.35, 0.05), smoothstep(0.35, 0.75, glow));
          terrain = mix(terrain, magma, uHeat);
        }
        // cross-fade: photographic only where the reconstruction agrees with modern coastlines
        float agreement = 1.0 - abs(land - (1.0 - water));
        float photoMix = uPhoto * mix(0.5, 1.0, agreement);
        if (uHasFrames < 0.5) photoMix = 1.0;
        if (uCompare > 0.5) photoMix = step(0.5, vUv.x); // wipe: right half today
        vec3 albedo = mix(terrain, photo, photoMix);
        vec3 Nshade = normalize(mix(Nn, N, photoMix));
        float waterMix = mix(1.0 - land, water, photoMix);

        float ndl = dot(Nshade, L);
        float ndlGeo = dot(N, L);
        float daylight = smoothstep(-0.08, 0.25, ndlGeo);
        float diffuse = max(ndl, 0.0);
        float cloudShadow = 1.0;
        float cloudsHere = 0.0;
        if (uHasClouds > 0.5 && uCloudOpacity > 0.001) {
          vec2 sunT = vec2(dot(L, T), dot(L, B)) * 0.008;
          float c = texture2D(uClouds, vec2(fract(vUv.x + uCloudShift + sunT.x), clamp(vUv.y + sunT.y, 0.0, 1.0))).r * uCloudOpacity;
          cloudShadow = 1.0 - c * 0.5 * daylight;
          cloudsHere = texture2D(uClouds, vec2(fract(vUv.x + uCloudShift), vUv.y)).r * uCloudOpacity;
        }
        vec3 sun = mix(vec3(1.0, 0.97, 0.92), vec3(0.55, 0.65, 1.0), uBlueHour);
        vec3 col = albedo * diffuse * uSunIntensity * cloudShadow * sun;
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(Nshade, H), 0.0), 80.0) * waterMix * daylight;
        col += vec3(1.0, 0.95, 0.85) * spec * mix(0.7, 1.4, photoMix) * (1.0 - cloudsHere * 0.8);
        // night lights only exist today
        if (uHasNight > 0.5) {
          vec3 night = texture2D(uNight, vUv).rgb;
          float warmth = clamp((night.r - night.b) * 3.0 + 0.2, 0.0, 1.0);
          float nightMask = 1.0 - smoothstep(-0.2, 0.1, ndlGeo);
          col += night * (0.6 + 0.9 * warmth) * vec3(1.0, 0.82, 0.55) * nightMask * 1.8 * photoMix * (1.0 - cloudsHere * 0.7) * (1.0 + uNightMode * 1.5);
          col += albedo * 0.012 * nightMask;
        }
        col += magmaGlow(uHeat, vUv, uTime) * (1.0 - daylight);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float twilight = exp(-pow(ndlGeo * 3.0, 2.0));
        vec3 atmo = mix(vec3(0.43, 0.69, 1.0), vec3(0.8, 0.21, 0.04), uHeat);
        vec3 rimCol = mix(atmo, vec3(1.0, 0.45, 0.2), twilight * 0.6 * (1.0 - uHeat));
        col += rimCol * rim * (0.25 + 0.75 * daylight) * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`.replace('void main() {', /* glsl */ `
      vec3 magmaGlow(float heat, vec2 uv, float t) {
        if (heat < 0.001) return vec3(0.0);
        float g = fbm(uv * vec2(60.0, 30.0) + t * 0.01);
        return vec3(1.0, 0.3, 0.05) * smoothstep(0.45, 0.8, g) * heat * 1.2;
      }
      void main() {`),
  });
}
