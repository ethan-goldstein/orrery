import { describe, expect, it } from 'vitest';
import { almanacNow, illuminatedFraction, inWords, phaseName } from '@/astro/almanac';

const NOW = Date.UTC(2026, 8, 14, 12);

describe('almanac helpers', () => {
  it('names the phases around the compass', () => {
    expect(phaseName(0)).toBe('New');
    expect(phaseName(90)).toBe('First quarter');
    expect(phaseName(180)).toBe('Full');
    expect(phaseName(270)).toBe('Last quarter');
    expect(phaseName(359)).toBe('New');
  });
  it('lights the disc from 0 at new to 1 at full', () => {
    expect(illuminatedFraction(0)).toBeCloseTo(0, 9);
    expect(illuminatedFraction(90)).toBeCloseTo(0.5, 9);
    expect(illuminatedFraction(180)).toBeCloseTo(1, 9);
  });
  it('says when in plain words', () => {
    expect(inWords(NOW + 30 * 60_000, NOW)).toBe('within the hour');
    expect(inWords(NOW + 3 * 3_600_000, NOW)).toBe('in 3 hours');
    expect(inWords(NOW + 26 * 3_600_000, NOW)).toBe('tomorrow');
    expect(inWords(NOW + 12 * 86_400_000, NOW)).toBe('in 12 days');
    expect(inWords(NOW + 95 * 86_400_000, NOW)).toBe('in 3 months');
    expect(inWords(NOW - 1, NOW)).toBe('passed');
  });
});

describe('almanacNow', () => {
  it('reports the Moon, the Sun, the next eclipse and full moon, and the data counts', () => {
    const rows = almanacNow(NOW, { orbit: { count: 19_799, snapshot: '2026-09-14' }, quakes: { count: 3974, end: '2026-09-15' } });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('moon');
    expect(ids).toContain('sun');
    expect(ids.some((id) => id.endsWith('eclipse'))).toBe(true);
    expect(ids).toContain('full-moon');
    expect(ids).toContain('orbit');
    expect(ids).toContain('quakes');
    const sun = rows.find((r) => r.id === 'sun')!;
    // mid-September the Earth is a little over 1 AU from the Sun
    expect(Number(sun.value.split(' ')[0])).toBeGreaterThan(1.0);
    expect(Number(sun.value.split(' ')[0])).toBeLessThan(1.02);
    const moon = rows.find((r) => r.id === 'moon')!;
    expect(moon.note).toMatch(/^\d{1,3}% lit · 3\d\d,\d{3} km away$/);
    for (const r of rows) expect(r.href.startsWith('/')).toBe(true);
  });
  it('works without data status', () => {
    const rows = almanacNow(NOW);
    expect(rows.find((r) => r.id === 'orbit')).toBeUndefined();
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
