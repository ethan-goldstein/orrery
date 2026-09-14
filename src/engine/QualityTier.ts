export type TierName = 'low' | 'med' | 'high' | 'ultra';

export interface Tier {
  name: TierName;
  dprCap: number;
  textureTier: '1k' | '2k' | '4k';
  sphereSegments: number;
  bloom: boolean;
  shadows: 0 | 2048 | 4096;
  starCap: number;
  satelliteCap: number;
  smaa: boolean;
}

export const TIERS: Record<TierName, Tier> = {
  low: { name: 'low', dprCap: 1, textureTier: '1k', sphereSegments: 64, bloom: false, shadows: 0, starCap: 3000, satelliteCap: 5000, smaa: false },
  med: { name: 'med', dprCap: 1.5, textureTier: '2k', sphereSegments: 96, bloom: true, shadows: 0, starCap: 9000, satelliteCap: 12000, smaa: true },
  high: { name: 'high', dprCap: 2, textureTier: '2k', sphereSegments: 128, bloom: true, shadows: 2048, starCap: 9000, satelliteCap: Infinity, smaa: true },
  ultra: { name: 'ultra', dprCap: 2, textureTier: '4k', sphereSegments: 192, bloom: true, shadows: 4096, starCap: 9000, satelliteCap: Infinity, smaa: true },
};

export interface ProbeInput {
  cores: number;
  dpr: number;
  maxTextureSize: number;
  mobile: boolean;
  memoryGb?: number;
}

/** Cheap static guess. Frame-time calibration (Phase 5) can demote later. */
export function probeTier(p: ProbeInput): TierName {
  if (p.maxTextureSize < 4096) return 'low';
  if (p.mobile) return p.cores >= 6 && p.maxTextureSize >= 8192 ? 'med' : 'low';
  if (p.cores >= 8 && p.maxTextureSize >= 16384 && (p.memoryGb ?? 8) >= 8) return 'ultra';
  if (p.cores >= 4) return 'high';
  return 'med';
}

export function probeFromBrowser(gl: WebGL2RenderingContext): TierName {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return probeTier({
    cores: nav.hardwareConcurrency ?? 4,
    dpr: window.devicePixelRatio ?? 1,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    mobile: /Android|iPhone|iPad|Mobile/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && window.innerWidth < 1024),
    memoryGb: nav.deviceMemory,
  });
}
