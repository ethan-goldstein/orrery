import { useClock } from '@/store/clock';
import { formatUtc, isReliable, RATE_PRESETS } from '@/astro/time';
import { useExperience } from '@/store/experience';
import { writeUrl } from '@/app/url-state';
import { useEffect } from 'react';

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  if (d.getUTCFullYear() < 1 || d.getUTCFullYear() > 9999) return '';
  return d.toISOString().slice(0, 16);
}

export function TimeBar() {
  const epochMs = useClock((s) => s.epochMs);
  const rate = useClock((s) => s.rate);
  const playing = useClock((s) => s.playing);
  const followNow = useClock((s) => s.followNow);
  const toggle = useClock((s) => s.toggle);
  const setRate = useClock((s) => s.setRate);
  const setFollow = useClock((s) => s.setFollowNow);
  const setEpoch = useClock((s) => s.setEpoch);
  const cleanView = useExperience((s) => s.cleanView);
  const minute = Math.floor(epochMs / 60000);

  useEffect(() => {
    writeUrl((p) => {
      if (followNow) p.set('t', 'now');
      else p.set('t', new Date(epochMs).toISOString());
      if (rate === 1) p.delete('rate');
      else p.set('rate', String(rate));
    });
  }, [followNow, rate, minute]);

  if (cleanView) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-full bg-ink-2/80 backdrop-blur px-4 py-2 text-sm w-fit"
      data-ui
      data-testid="timebar"
    >
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause time' : 'Play time'}
        aria-pressed={playing}
        className="w-8 h-8 rounded-full bg-fog/10 hover:bg-fog/20"
      >
        {playing ? 'Ⅱ' : '▶'}
      </button>
      <label className="relative">
        <time dateTime={new Date(epochMs).toISOString()} className="font-mono tabular-nums" data-testid="sim-time" title={isReliable(epochMs) ? 'UTC' : 'Outside 1700–2200: planetary positions are extrapolated'}>
          {formatUtc(epochMs)}
          {!isReliable(epochMs) && <span className="text-glow ml-1" aria-label="extrapolated">≈</span>}
        </time>
        <input
          type="datetime-local"
          aria-label="Jump to date (UTC)"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={toLocalInput(epochMs)}
          onChange={(e) => {
            const v = e.target.value;
            if (v) setEpoch(Date.parse(`${v}Z`));
          }}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="kicker">Rate</span>
        <select
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="bg-transparent"
          aria-label="Simulation speed"
        >
          {RATE_PRESETS.map((r) => (
            <option key={r.rate} value={r.rate} className="bg-ink-2">
              {r.label}
            </option>
          ))}
          {!RATE_PRESETS.some((r) => r.rate === rate) && (
            <option value={rate} className="bg-ink-2">
              {rate === 0 ? 'Frozen' : `${rate} s / s`}
            </option>
          )}
        </select>
      </label>
      <button
        onClick={() => setFollow(!followNow)}
        aria-pressed={followNow}
        className={`rounded-full px-3 py-1 ${followNow ? 'bg-glow/20 text-glow' : 'bg-fog/10 hover:bg-fog/20'}`}
      >
        Now
      </button>
    </div>
  );
}
