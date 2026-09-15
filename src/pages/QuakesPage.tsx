import { useEffect } from 'react';
import { useExperience } from '@/app/EngineContext';
import { QuakesExperience } from '@/experiences/quakes/QuakesExperience';
import { quakeStore, useQuakes, type QuakePreset } from '@/store/quakes';
import { useExperience as useExperienceState } from '@/store/experience';
import { writeUrl } from '@/app/url-state';

let current: QuakesExperience | null = null;
const factory = () => (current = new QuakesExperience());

const PRESETS: { id: QuakePreset; label: string }[] = [
  { id: 'all', label: 'All earthquakes' },
  { id: 'pacific', label: 'Pacific rim' },
  { id: 'japan2011', label: 'Japan 2011' },
  { id: 'deep', label: 'Deep Earth' },
];

export default function QuakesPage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const preset = p.get('preset') as QuakePreset | null;
    const patch: Partial<ReturnType<typeof quakeStore.getState>> = {};
    if (preset && PRESETS.some((x) => x.id === preset)) patch.preset = preset;
    const year = Number(p.get('year'));
    if (p.get('year') && Number.isFinite(year)) patch.throughSeconds = Date.UTC(year, 11, 31) / 1000;
    const q = p.get('q');
    if (q) patch.selected = q;
    quakeStore.setState(patch);
  }, []);
  useExperience('quakes', factory);
  const preset = useQuakes((s) => s.preset);
  const through = useQuakes((s) => s.throughSeconds);
  const playing = useQuakes((s) => s.playing);
  const visible = useQuakes((s) => s.visibleCount);
  const total = useQuakes((s) => s.totalCount);
  const range = useQuakes((s) => s.range);
  const info = useQuakes((s) => s.selectedInfo);
  const retrieved = useQuakes((s) => s.retrieved);
  const cleanView = useExperienceState((s) => s.cleanView);
  const set = quakeStore.getState().set;
  const year = new Date(through * 1000).getUTCFullYear();

  useEffect(() => {
    writeUrl((p) => {
      p.set('preset', preset);
      p.set('year', String(year));
      if (info) p.set('q', info.id);
      else p.delete('q');
    });
  }, [preset, year, info]);

  if (cleanView) return null;
  return (
    <>
      <section className="p-5 md:p-8 max-w-md pointer-events-none" aria-live="polite">
        <p className="kicker">The ground is moving</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-2">{info ? `M${info.mag.toFixed(1)}` : 'A planet in motion.'}</h1>
        <p className="mt-2 text-fog-2 leading-relaxed">
          {info
            ? `${info.place}. ${new Date(info.time * 1000).toUTCString().slice(0, 16)}, ${info.depthKm} km deep.`
            : 'Every light is a recorded earthquake of magnitude 6 or more. Together they trace the edges of plates that never stop moving.'}
        </p>
        {info && (
          <a className="mt-2 inline-block text-xs underline pointer-events-auto" data-ui href={`https://earthquake.usgs.gov/earthquakes/eventpage/${info.id}`} target="_blank" rel="noopener noreferrer">
            USGS event page ↗
          </a>
        )}
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          {PRESETS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={preset === p.id} onClick={() => set({ preset: p.id, selected: null })}>
              {p.label}
            </button>
          ))}
          <button className="chip" onClick={() => set(playing ? { playing: false } : { throughSeconds: range.start, playing: true })} data-testid="quakes-play">
            {playing ? 'Ⅱ Pause' : '▶ Play'}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker w-24">Through {year}</span>
          <input type="range" min={range.start} max={range.end} step={86400} value={through} onChange={(e) => set({ throughSeconds: Number(e.target.value), playing: false })} aria-label="Show earthquakes through year" className="w-56" data-testid="quakes-scrub" />
        </label>
      </section>
      <aside className="panel fixed right-4 top-20 w-64 p-4 hidden md:block" data-ui data-testid="quakes-panel">
        <p className="text-3xl font-semibold tabular-nums">{visible.toLocaleString()}</p>
        <p className="kicker">recorded M6+ earthquakes shown</p>
        <p className="text-xs text-fog-2 mt-1">
          of {total.toLocaleString()} since 2000 · USGS catalogue as of <span data-testid="quakes-retrieved">{retrieved || '…'}</span>
        </p>
        <ul className="mt-3 text-xs space-y-1">
          <li>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'rgb(255,209,115)' }} />
            0–70 km
          </li>
          <li>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'rgb(255,107,64)' }} />
            70–300 km
          </li>
          <li>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'rgb(128,140,255)' }} />
            300+ km
          </li>
        </ul>
        <p className="text-xs text-fog-2 mt-3">USGS · M6+ · 2000–today · cumulative records, not a hazard forecast · select a light to inspect</p>
        <div className="mt-3 flex gap-2">
          <button className="chip" onClick={() => current?.zoom(0.8)} aria-label="Zoom in">
            +
          </button>
          <button className="chip" onClick={() => current?.zoom(1.25)} aria-label="Zoom out">
            −
          </button>
        </div>
      </aside>
    </>
  );
}
