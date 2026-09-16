import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MIN, STEPS, tickLabel, tickStepFor, windowHalfWidthMs, YEAR } from '@/ui/shell/scrubber-math';

describe('time scrubber window', () => {
  it('shows at least six hours either side when frozen or real time', () => {
    expect(windowHalfWidthMs(0)).toBe(6 * HOUR);
    expect(windowHalfWidthMs(1)).toBe(6 * HOUR);
  });
  it('widens with the rate and caps at 200 years', () => {
    expect(windowHalfWidthMs(3600)).toBe(120 * HOUR);
    expect(windowHalfWidthMs(-3600)).toBe(120 * HOUR);
    expect(windowHalfWidthMs(31_557_600 * 1000)).toBe(200 * YEAR);
  });
});

describe('tick step', () => {
  it('keeps between 2 and 12 ticks across the window for every window size', () => {
    for (let hw = 6 * HOUR; hw <= 200 * YEAR; hw *= 1.7) {
      const step = tickStepFor(hw);
      const n = (2 * hw) / step;
      expect(n).toBeLessThanOrEqual(12);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(STEPS).toContain(step);
    }
  });
  it('picks hours for a day-long window and years for a century', () => {
    expect(tickStepFor(12 * HOUR)).toBe(6 * HOUR);
    expect(tickStepFor(50 * YEAR)).toBe(10 * YEAR);
  });
});

describe('tick labels', () => {
  it('labels by the step size', () => {
    const t = Date.UTC(2026, 8, 14, 12, 30);
    expect(tickLabel(t, MIN)).toBe('12:30');
    expect(tickLabel(t, DAY)).toBe('14 Sep');
    expect(tickLabel(t, YEAR)).toBe('2026');
  });
});
