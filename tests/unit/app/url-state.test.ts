import { describe, expect, it } from 'vitest';
import { parseSharedState, serializeSharedState } from '@/app/url-state';

describe('url state', () => {
  it('round-trips', () => {
    const s = { t: '2026-09-14T12:00:00.000Z', rate: 3600, labels: false, q: 'high' as const };
    expect(parseSharedState(serializeSharedState(s))).toEqual(s);
  });
  it('accepts now and rejects garbage', () => {
    expect(parseSharedState('?t=now&rate=abc&q=huge')).toEqual({ t: 'now' });
  });
  it('preserves unrelated params', () => {
    expect(serializeSharedState({ rate: 60 }, 'body=mars')).toBe('?body=mars&rate=60');
  });
});
