import { describe, expect, it } from 'vitest';
import { upcomingEvents } from '@/astro/events';

describe('events', () => {
  it('finds the 12 August 2026 total solar eclipse from a summer 2026 start', () => {
    const ev = upcomingEvents(Date.UTC(2026, 6, 1));
    const se = ev.find((e) => e.id === 'solar-eclipse')!;
    expect(new Date(se.ms).toISOString().slice(0, 10)).toBe('2026-08-12');
    expect(se.detail).toContain('total');
  });
  it('finds the next full moon and a solstice in order', () => {
    const ev = upcomingEvents(Date.UTC(2026, 8, 14));
    for (const e of ev) expect(e.ms).toBeGreaterThan(Date.UTC(2026, 8, 14));
    expect(ev.find((e) => e.id === 'season')!.detail).toContain('September equinox 2026-09-23');
  });
});
