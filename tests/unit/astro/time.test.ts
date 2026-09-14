import { describe, expect, it } from 'vitest';
import { advance, formatUtc, HARD_RANGE, isReliable, julianDate, J2000_MS, type ClockState } from '@/astro/time';

const base: ClockState = { epochMs: J2000_MS, rate: 86_400, playing: true, followNow: false };

describe('SimClock', () => {
  it('advances by rate * dt', () => {
    expect(advance(base, 0.5).epochMs).toBe(J2000_MS + 43_200_000);
  });
  it('does not move when paused', () => {
    const paused = { ...base, playing: false };
    expect(advance(paused, 10)).toBe(paused);
    expect(advance(paused, 10).epochMs).toBe(J2000_MS);
  });
  it('tracks wall time in followNow', () => {
    const s = advance({ ...base, followNow: true }, 5, 1_000_000);
    expect(s.epochMs).toBe(1_000_000);
    expect(s.rate).toBe(1);
  });
  it('clamps to the hard range', () => {
    expect(advance({ ...base, rate: 1e15 }, 1e6).epochMs).toBe(HARD_RANGE.max);
  });
  it('knows the J2000 Julian date', () => {
    expect(julianDate(J2000_MS)).toBeCloseTo(2451545.0, 9);
  });
  it('flags the reliable range', () => {
    expect(isReliable(Date.UTC(2026, 8, 14))).toBe(true);
    expect(isReliable(Date.UTC(1500, 0, 1))).toBe(false);
  });
  it('formats UTC', () => {
    expect(formatUtc(Date.UTC(2026, 8, 14, 12, 5))).toBe('2026-09-14 12:05 UTC');
  });
});
