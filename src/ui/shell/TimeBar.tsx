import { useClock } from '@/store/clock';
import { formatUtc, RATE_PRESETS } from '@/astro/time';
import { useExperience } from '@/store/experience';
import { writeUrl } from '@/app/url-state';
import { useEffect } from 'react';

export function TimeBar() {
  const epochMs = useClock((s) => s.epochMs);
  const rate = useClock((s) => s.rate);
  const playing = useClock((s) => s.playing);
  const followNow = useClock((s) => s.followNow);
  const toggle = useClock((s) => s.toggle);
  const setRate = useClock((s) => s.setRate);
  const setFollow = useClock((s) => s.setFollowNow);
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
      <time dateTime={new Date(epochMs).toISOString()} className="font-mono tabular-nums" data-testid="sim-time">
        {formatUtc(epochMs)}
      </time>
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
              {rate} s / s
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
