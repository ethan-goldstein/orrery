import { useEffect } from 'react';
import { useClock } from '@/store/clock';
import { formatUtc, isReliable, RATE_PRESETS } from '@/astro/time';
import { useExperience } from '@/store/experience';
import { writeUrl } from '@/app/url-state';
import { ZoomControl } from './ZoomControl';
import { TimeScrubber } from './TimeScrubber';
import { EraScrubber } from './EraScrubber';
import { WorldDock } from './WorldDock';
import { useNarrow } from './useNarrow';
import { useShell } from '@/store/shell';
import { Glyph } from './icons';

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  if (d.getUTCFullYear() < 1 || d.getUTCFullYear() > 9999) return '';
  return d.toISOString().slice(0, 16);
}

const RATES = RATE_PRESETS.map((r) => r.rate);

/**
 * The instrument bar: world dock (Solar), transport, the time scrubber (or
 * Earth's era track), the UTC readout, the rate stepper, Now, and the camera.
 */
export function InstrumentBar() {
  const epochMs = useClock((s) => s.epochMs);
  const rate = useClock((s) => s.rate);
  const playing = useClock((s) => s.playing);
  const followNow = useClock((s) => s.followNow);
  const toggle = useClock((s) => s.toggle);
  const setRate = useClock((s) => s.setRate);
  const setFollow = useClock((s) => s.setFollowNow);
  const setEpoch = useClock((s) => s.setEpoch);
  const cleanView = useExperience((s) => s.cleanView);
  const active = useExperience((s) => s.active);
  const narrow = useNarrow();
  const drawer = useShell((s) => s.drawerOpen);
  const toggleDrawer = useShell((s) => s.toggleDrawer);
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
  const rateIndex = RATES.findIndex((r) => r >= rate);
  const stepRate = (dir: 1 | -1) => {
    const i = rateIndex < 0 ? RATES.length - 1 : rateIndex;
    setRate(RATES[Math.min(RATES.length - 1, Math.max(0, i + dir))]!);
  };
  const earth = active === 'earth';
  return (
    <div className="instrument-bar card" data-ui data-testid="timebar">
      {active === 'solar' && !narrow && <WorldDock />}
      <div className="ib-group">
        <button onClick={toggle} aria-label={playing ? 'Pause time' : 'Play time'} aria-pressed={playing} className="ib-btn" title={playing ? 'Pause (Space)' : 'Play (Space)'}>
          {playing ? <Glyph.pause /> : <Glyph.play />}
        </button>
        {earth ? <EraScrubber /> : !narrow && <TimeScrubber />}
      </div>
      <div className="ib-group">
        <label className="relative ib-time">
          <time dateTime={new Date(epochMs).toISOString()} className="font-mono tabular-nums" data-testid="sim-time" title={isReliable(epochMs) ? 'UTC · click to jump to a date' : 'Outside 1700–2200: planetary positions are extrapolated'}>
            {formatUtc(epochMs)}
            {!isReliable(epochMs) && (
              <span className="text-brass ml-1" aria-label="extrapolated">
                ≈
              </span>
            )}
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
        <div className="ib-rate">
          <button className="ib-btn ib-btn-sm" onClick={() => stepRate(-1)} aria-label="Slower" title="Slower ([)">
            <Glyph.stepBack size={16} />
          </button>
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="ib-select" aria-label="Simulation speed">
            {RATE_PRESETS.map((r) => (
              <option key={r.rate} value={r.rate}>
                {r.label}
              </option>
            ))}
            {!RATE_PRESETS.some((r) => r.rate === rate) && <option value={rate}>{rate === 0 ? 'Frozen' : `${rate} s / s`}</option>}
          </select>
          <button className="ib-btn ib-btn-sm" onClick={() => stepRate(1)} aria-label="Faster" title="Faster (])">
            <Glyph.stepForward size={16} />
          </button>
        </div>
        <button onClick={() => setFollow(!followNow)} aria-pressed={followNow} className="seg-btn" title="Follow the real clock (N)">
          Now
        </button>
      </div>
      <ZoomControl />
      {active !== 'home' && !narrow && (
        <button onClick={toggleDrawer} aria-pressed={drawer} className="seg-btn ib-facts" aria-label={drawer ? 'Hide facts' : 'Show facts'} title="Facts (I)">
          Facts
        </button>
      )}
    </div>
  );
}
