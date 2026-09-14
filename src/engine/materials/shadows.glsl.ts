/**
 * Analytic soft shadows from up to MAX_CASTERS spheres (planets eclipsing
 * moons, the Moon eclipsing Earth) plus an optional ring plane. All in the
 * scene frame of the current frame, using display radii so the shadows agree
 * with whatever scale the viewer has chosen.
 */
export const MAX_CASTERS = 3;

export const shadowUniforms = () => ({
  uSunPos: { value: [0, 0, 0] },
  uSunRadius: { value: 1 },
  uCasterCount: { value: 0 },
  uCasters: { value: new Float32Array(MAX_CASTERS * 4) },
  uRingEnabled: { value: 0 },
  uRingCenter: { value: [0, 0, 0] },
  uRingNormal: { value: [0, 1, 0] },
  uRingInner: { value: 1 },
  uRingOuter: { value: 2 },
  uRingMap: { value: null as unknown },
  uRingOpacity: { value: 1 },
});

export const shadowPars = /* glsl */ `
  uniform vec3 uSunPos;
  uniform float uSunRadius;
  uniform int uCasterCount;
  uniform vec4 uCasters[${MAX_CASTERS}];
  uniform float uRingEnabled;
  uniform vec3 uRingCenter;
  uniform vec3 uRingNormal;
  uniform float uRingInner;
  uniform float uRingOuter;
  uniform sampler2D uRingMap;
  uniform float uRingOpacity;

  // Fraction of the Sun's disc still visible from world point P.
  float sphereShadow(vec3 P) {
    vec3 toSun = uSunPos - P;
    float dSun = length(toSun);
    vec3 s = toSun / dSun;
    float alphaS = uSunRadius / dSun;
    float light = 1.0;
    for (int i = 0; i < ${MAX_CASTERS}; i++) {
      if (i >= uCasterCount) break;
      vec3 c = uCasters[i].xyz - P;
      float along = dot(c, s);
      if (along <= 0.0 || along >= dSun) continue;
      float dc = length(c);
      float alphaC = uCasters[i].w / dc;
      float theta = length(c - along * s) / dc;
      float covered;
      if (theta >= alphaS + alphaC) covered = 0.0;
      else if (theta <= abs(alphaC - alphaS)) covered = alphaC >= alphaS ? 1.0 : (alphaC * alphaC) / (alphaS * alphaS);
      else {
        float t = (alphaS + alphaC - theta) / (2.0 * min(alphaS, alphaC));
        covered = smoothstep(0.0, 1.0, t) * (alphaC >= alphaS ? 1.0 : (alphaC * alphaC) / (alphaS * alphaS));
      }
      light *= 1.0 - covered;
    }
    return light;
  }

  // Ring plane shadow: cast the sun ray from P onto the ring plane and read alpha.
  float ringShadow(vec3 P) {
    if (uRingEnabled < 0.5) return 1.0;
    vec3 s = normalize(uSunPos - P);
    float denom = dot(s, uRingNormal);
    if (abs(denom) < 1e-5) return 1.0;
    float t = dot(uRingCenter - P, uRingNormal) / denom;
    if (t <= 0.0) return 1.0;
    vec3 hit = P + s * t;
    float rho = length(hit - uRingCenter);
    if (rho < uRingInner || rho > uRingOuter) return 1.0;
    float u = (rho - uRingInner) / (uRingOuter - uRingInner);
    float a = texture2D(uRingMap, vec2(u, 0.5)).a * uRingOpacity;
    return 1.0 - a * 0.92;
  }
`;
