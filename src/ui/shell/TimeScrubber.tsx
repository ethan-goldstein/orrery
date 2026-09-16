import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { clockStore, useClock } from '@/store/clock';
import { clampMs, formatUtc } from '@/astro/time';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const YEAR = 31_557_600_000;
/** tick spacings to choose from, ms */
const STEPS = [MIN, 5 * MIN, 15 * MIN, HOUR, 6 * HOUR, DAY, 7 * DAY, 30.44 * DAY, YEAR, 10 * YEAR, 100 * YEAR, 1000 * YEAR];

/** Half-width of the visible window: two minutes of playback at the current rate, clamped to 6 h … 200 y. */
export function windowHalfWidthMs(rate: number): number {
  return Math.min(200 * YEAR, Math.max(6 * HOUR, Math.abs(rate) * 120 * 1000));
}

export function tickStepFor(halfWidth: number): number {
  const span = 2 * halfWidth;
  for (const s of STEPS) if (span / s <= 12) return s;
  return STEPS[STEPS.length - 1]!;
}

function tickLabel(ms: number, step: number): string {
  const d = new Date(ms);
  if (step >= YEAR) return String(d.getUTCFullYear());
  if (step >= DAY) return `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * A real scrubber for simulation time: the needle stays centred, the track
 * slides beneath it. Drag to move through time, wheel over it to nudge,
 * arrow keys to step. The window widens with the playback rate so ticks are
 * always legible.
 */
export function TimeScrubber() {
  const rate = useClock((s) => s.rate);
  const W = windowHalfWidthMs(rate);
  // re-render at most every W/40 of simulated time while the clock runs
  const coarse = useClock((s) => Math.floor(s.epochMs / (W / 40)));
  const epochMs = coarse * (W / 40);
  const step = tickStepFor(W);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; epoch: number } | null>(null);
  const width = 220;

  const ticks = useMemo(() => {
    const out: { x: number; label: string; major: boolean }[] = [];
    const first = Math.floor((epochMs - W) / step) * step;
    for (let t = first; t <= epochMs + W; t += step) {
      const x = ((t - epochMs + W) / (2 * W)) * width;
      if (x < 0 || x > width) continue;
      const major = Math.round(t / step) % 2 === 0;
      out.push({ x, label: major ? tickLabel(t, step) : '', major });
    }
    return out;
  }, [epochMs, W, step]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, epoch: clockStore.getState().epochMs });
    clockStore.getState().setPlaying(false);
    clockStore.getState().setFollowNow(false);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    clockStore.getState().setEpoch(clampMs(drag.epoch - (dx / width) * 2 * W));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(null);
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const d = e.deltaX || e.deltaY;
    clockStore.getState().setEpoch(clampMs(clockStore.getState().epochMs + (d / 100) * (W / 10)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const c = clockStore.getState();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      c.setEpoch(clampMs(c.epochMs + (e.key === 'ArrowRight' ? 1 : -1) * (W / 20)));
    }
  };

  return (
    <div
      ref={ref}
      className={`time-scrubber${drag ? ' is-dragging' : ''}`}
      role="slider"
      aria-label="Simulation time"
      aria-valuetext={formatUtc(epochMs)}
      aria-valuenow={Math.round(epochMs / 1000)}
      tabIndex={0}
      data-ui
      data-testid="time-scrubber"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKey}
      style={{ width }}
    >
      <svg width={width} height={28} viewBox={`0 0 ${width} 28`} aria-hidden="true">
        <line x1="0" y1="14" x2={width} y2="14" className="ts-rail" />
        {ticks.map((t, i) => (
          <g key={i} transform={`translate(${t.x.toFixed(1)} 0)`}>
            <line x1="0" y1={t.major ? 8 : 11} x2="0" y2={t.major ? 20 : 17} className="ts-tick" />
            {t.label && (
              <text x="0" y="27" textAnchor="middle" className="ts-label">
                {t.label}
              </text>
            )}
          </g>
        ))}
        <path d={`M${width / 2} 2 l4 5 v14 l-4 5 l-4 -5 v-14 z`} className="ts-needle" />
      </svg>
    </div>
  );
}
