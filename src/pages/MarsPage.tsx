import { useEffect, useState } from 'react';
import { useExperience } from '@/app/EngineContext';
import { MarsExperience, type Site } from '@/experiences/mars/MarsExperience';
import { marsStore, useMars } from '@/store/mars';
import { useExperience as useExperienceState } from '@/store/experience';
import { assetUrl } from '@/engine/Assets';
import { writeUrl } from '@/app/url-state';
import { useClock } from '@/store/clock';
import { planetPositionKm } from '@/astro/ephemeris';
import { AU_KM } from '@/astro/scale';

let current: MarsExperience | null = null;
const factory = () => (current = new MarsExperience());

const PRESETS: { id: string; label: string; headline: string }[] = [
  { id: 'global', label: 'Whole planet', headline: 'The red frontier.' },
  { id: 'olympus', label: 'Olympus Mons', headline: 'The tallest mountain.' },
  { id: 'marineris', label: 'Valles Marineris', headline: 'A canyon across a continent.' },
  { id: 'polar', label: 'North pole', headline: 'Ice, and dry ice.' },
  { id: 'hellas', label: 'Hellas basin', headline: 'The deepest hole.' },
];

export default function MarsPage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const site = p.get('site');
    const preset = p.get('preset');
    const patch: Partial<ReturnType<typeof marsStore.getState>> = {};
    if (site) patch.site = site;
    if (preset && PRESETS.some((x) => x.id === preset)) patch.preset = preset;
    const dust = Number(p.get('dust'));
    if (p.get('dust') && Number.isFinite(dust)) patch.dust = Math.min(1, Math.max(0, dust));
    marsStore.setState(patch);
  }, []);
  useExperience('mars', factory);
  const preset = useMars((s) => s.preset);
  const site = useMars((s) => s.site);
  const sunlight = useMars((s) => s.sunlight);
  const tour = useMars((s) => s.tour);
  const dust = useMars((s) => s.dust);
  const cleanView = useExperienceState((s) => s.cleanView);
  const epochMs = useClock((s) => s.epochMs);
  const set = marsStore.getState().set;
  const [sites, setSites] = useState<Site[]>([]);
  useEffect(() => {
    fetch(assetUrl('data/mars/sites.json'))
      .then((r) => r.json())
      .then((d) => setSites(d.sites))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    writeUrl((p) => {
      if (site) p.set('site', site);
      else p.delete('site');
      p.set('preset', preset);
      p.set('dust', dust.toFixed(2));
    });
  }, [site, preset, dust]);

  const active = sites.find((s) => s.id === site);
  const m = planetPositionKm('mars', epochMs);
  const e = planetPositionKm('earth', epochMs);
  const earthDistanceKm = Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]);
  const lightMin = earthDistanceKm / 299_792.458 / 60;
  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0]!;
  if (cleanView) return null;
  return (
    <>
      <section className="p-5 md:p-8 max-w-md pointer-events-none" aria-live="polite">
        <p className="kicker">{active ? `${active.agency} · ${active.date}` : 'The fourth planet'}</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-2" key={active?.id ?? preset} data-testid="mars-title">
          {active ? active.name : p.headline}
        </h1>
        <p className="mt-2 text-fog-2 leading-relaxed">
          {active ? active.blurb : preset === 'olympus' ? 'Olympus Mons rises 22 km above the plains, three times Everest, with a base the size of Arizona.' : preset === 'marineris' ? 'Valles Marineris runs 4,000 km along the equator, up to 7 km deep. It would stretch across the United States.' : preset === 'polar' ? 'The northern cap is water ice under a winter blanket of frozen carbon dioxide that comes and goes with the seasons.' : preset === 'hellas' ? 'Hellas is 2,300 km wide and 7 km deep, the largest visible impact basin in the Solar System.' : 'Half the size of Earth, a day 37 minutes longer than ours, and every landing site ever reached. Oriented for the real date.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          {PRESETS.map((x) => (
            <button key={x.id} className="chip" aria-pressed={preset === x.id && !site} onClick={() => set({ preset: x.id, site: null, tour: false })}>
              {x.label}
            </button>
          ))}
          <button className="chip" aria-pressed={tour} onClick={() => set({ tour: !tour })}>
            {tour ? 'Stop tour' : '▶ Guided tour'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" data-ui>
          <select className="chip bg-ink-2" aria-label="Missions and landings" value={site ?? ''} onChange={(e) => set({ site: e.target.value || null, tour: false })} data-testid="site-select">
            <option value="">Missions &amp; landings ({sites.length})</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.date.slice(0, 4)}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker w-16">Sunlight</span>
          <input type="range" min={0} max={1} step={0.005} value={sunlight ?? 0.5} onChange={(e) => set({ sunlight: Number(e.target.value) })} aria-label="Sunlight sweep" className="w-40" />
          <button className="chip" onClick={() => set({ sunlight: null })} aria-pressed={sunlight === null}>
            Real sun
          </button>
        </label>
        <label className="mt-2 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker w-16">Dust</span>
          <input type="range" min={0} max={1} step={0.01} value={dust} onChange={(e) => set({ dust: Number(e.target.value) })} aria-label="Atmospheric dust" className="w-40" data-testid="dust-slider" />
          <span className="text-fog-2">{dust < 0.3 ? 'clear' : dust < 0.7 ? 'hazy' : 'global storm'}</span>
        </label>
      </section>
      <aside className="panel fixed right-4 top-20 w-64 p-4 hidden md:block" data-ui data-testid="mars-panel">
        <p className="kicker">Right now</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums">{(earthDistanceKm / 1e6).toFixed(1)} million km</p>
        <p className="text-xs text-fog-2">from Earth · a signal takes {lightMin.toFixed(1)} min</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="kicker" style={{ fontSize: '0.58rem' }}>From Sun</dt>
            <dd className="mt-0.5">{(Math.hypot(...m) / AU_KM).toFixed(3)} AU</dd>
          </div>
          <div>
            <dt className="kicker" style={{ fontSize: '0.58rem' }}>Radius</dt>
            <dd className="mt-0.5">3,389.5 km</dd>
          </div>
          <div>
            <dt className="kicker" style={{ fontSize: '0.58rem' }}>Gravity</dt>
            <dd className="mt-0.5">3.71 m/s²</dd>
          </div>
          <div>
            <dt className="kicker" style={{ fontSize: '0.58rem' }}>Day</dt>
            <dd className="mt-0.5">24 h 37 min</dd>
          </div>
        </dl>
        <p className="text-xs text-fog-2 mt-3">Solar System Scope map · Phobos and Deimos at real positions, drawn 60x larger · {sunlight === null ? 'Real illumination' : 'Illustrative lighting'}</p>
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
