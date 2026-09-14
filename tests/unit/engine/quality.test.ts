import { describe, expect, it } from 'vitest';
import { probeTier, TIERS } from '@/engine/QualityTier';
import { bvToRgb } from '@/engine/Starfield';

describe('quality tiers', () => {
  it('caps DPR at 2 everywhere', () => {
    for (const t of Object.values(TIERS)) expect(t.dprCap).toBeLessThanOrEqual(2);
  });
  it('sends phones to low or med', () => {
    expect(probeTier({ cores: 4, dpr: 3, maxTextureSize: 4096, mobile: true })).toBe('low');
    expect(probeTier({ cores: 8, dpr: 3, maxTextureSize: 16384, mobile: true })).toBe('med');
  });
  it('sends a desktop workstation to ultra', () => {
    expect(probeTier({ cores: 12, dpr: 2, maxTextureSize: 16384, mobile: false, memoryGb: 16 })).toBe('ultra');
  });
});

describe('star colors', () => {
  it('makes hot stars blue and cool stars red', () => {
    const [r1, , b1] = bvToRgb(-0.3);
    const [r2, , b2] = bvToRgb(1.6);
    expect(b1).toBeGreaterThan(r1 * 0.9);
    expect(r2).toBeGreaterThan(b2);
  });
});
