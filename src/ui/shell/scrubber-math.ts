/** Pure helpers for the time scrubber (unit-tested). */
export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const YEAR = 31_557_600_000;
/** tick spacings to choose from, ms */
export const STEPS = [MIN, 5 * MIN, 15 * MIN, HOUR, 6 * HOUR, DAY, 2 * DAY, 7 * DAY, 30.44 * DAY, 91.31 * DAY, YEAR, 5 * YEAR, 10 * YEAR, 50 * YEAR, 100 * YEAR, 500 * YEAR, 1000 * YEAR];

/** Half-width of the visible window: two minutes of playback at the current rate, clamped to 6 h … 200 y. */
export function windowHalfWidthMs(rate: number): number {
  return Math.min(200 * YEAR, Math.max(6 * HOUR, Math.abs(rate) * 120 * 1000));
}

/** The coarsest step that still gives at least a few ticks and at most twelve across the window. */
export function tickStepFor(halfWidth: number): number {
  const span = 2 * halfWidth;
  for (const s of STEPS) if (span / s <= 12) return s;
  return STEPS[STEPS.length - 1]!;
}

export function tickLabel(ms: number, step: number): string {
  const d = new Date(ms);
  if (step >= YEAR) return String(d.getUTCFullYear());
  if (step >= DAY) return `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
