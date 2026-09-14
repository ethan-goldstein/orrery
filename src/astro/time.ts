/**
 * Simulation clock. Pure logic so it can run in vitest and in workers.
 * epochMs is milliseconds since the Unix epoch, UTC.
 */
export interface ClockState {
  epochMs: number;
  /** simulated seconds per real second */
  rate: number;
  playing: boolean;
  /** when true the clock tracks wall time and rate is forced to 1 */
  followNow: boolean;
}

export const MS_PER_DAY = 86_400_000;
export const J2000_MS = Date.UTC(2000, 0, 1, 12);
/** astronomy-engine is validated for 1700–2200; we warn outside this. */
export const RELIABLE_RANGE = { min: Date.UTC(1700, 0, 1), max: Date.UTC(2200, 0, 1) };
export const HARD_RANGE = { min: Date.UTC(-8000, 0, 1), max: Date.UTC(12000, 0, 1) };

export function advance(state: ClockState, realDtSeconds: number, nowMs = Date.now()): ClockState {
  if (state.followNow) return { ...state, epochMs: nowMs, rate: 1 };
  if (!state.playing) return state;
  const next = clampMs(state.epochMs + realDtSeconds * state.rate * 1000);
  return next === state.epochMs ? state : { ...state, epochMs: next };
}

export function clampMs(ms: number): number {
  if (!Number.isFinite(ms)) return J2000_MS;
  return Math.min(HARD_RANGE.max, Math.max(HARD_RANGE.min, ms));
}

export function isReliable(ms: number): boolean {
  return ms >= RELIABLE_RANGE.min && ms <= RELIABLE_RANGE.max;
}

export function julianDate(ms: number): number {
  return ms / MS_PER_DAY + 2440587.5;
}

export function daysSinceJ2000(ms: number): number {
  return (ms - J2000_MS) / MS_PER_DAY;
}

export function formatUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const y = d.getUTCFullYear();
  const year = y < 0 ? `-${pad(-y, 4)}` : y > 9999 ? `+${y}` : pad(y, 4);
  return `${year}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export const RATE_PRESETS: { label: string; rate: number }[] = [
  { label: 'Real time', rate: 1 },
  { label: '1 min / s', rate: 60 },
  { label: '1 hour / s', rate: 3600 },
  { label: '1 day / s', rate: 86_400 },
  { label: '3 days / s', rate: 259_200 },
  { label: '10 days / s', rate: 864_000 },
  { label: '1 month / s', rate: 2_629_800 },
  { label: '1 year / s', rate: 31_557_600 },
];
