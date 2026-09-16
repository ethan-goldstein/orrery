import { useEffect, useState } from 'react';
import { useExperience } from '@/app/EngineContext';
import { MoonExperience, type Site } from '@/experiences/moon/MoonExperience';
import { moonStore, useMoon, type MoonPreset } from '@/store/moon';
import { useExperience as useExperienceState } from '@/store/experience';
import { assetUrl } from '@/engine/Assets';
import { writeUrl } from '@/app/url-state';
import { useClock } from '@/store/clock';
import { moonPhaseDeg } from '@/astro/ephemeris';
import { moonPositionKm } from '@/astro/ephemeris';

const factory = () => new MoonExperience();

const PRESETS: { id: MoonPreset; label: string }[] = [
  { id: 'near', label: 'Near side' },
  { id: 'far', label: 'Far side' },
  { id: 'south', label: 'South pole' },
  { id: 'terminator', label: 'Light & shadow' },
];

export default function MoonPage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const site = p.get('site');
    const preset = p.get('preset') as MoonPreset | null;
    const patch: Partial<ReturnType<typeof moonStore.getState>> = {};
    if (site) patch.site = site;
    if (preset && PRESETS.some((x) => x.id === preset)) patch.preset = preset;
    moonStore.setState(patch);
  }, []);
  useExperience('moon', factory);
  const preset = useMoon((s) => s.preset);
  const site = useMoon((s) => s.site);
  const sunlight = useMoon((s) => s.sunlight);
  const tour = useMoon((s) => s.tour);
  const cleanView = useExperienceState((s) => s.cleanView);
  const epochMs = useClock((s) => s.epochMs);
  const set = moonStore.getState().set;
  const [sites, setSites] = useState<Site[]>([]);
  useEffect(() => {
    fetch(assetUrl('data/moon/sites.json'))
      .then((r) => r.json())
      .then((d) => setSites(d.sites))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    writeUrl((p) => {
      if (site) p.set('site', site);
      else p.delete('site');
      p.set('preset', preset);
    });
  }, [site, preset]);

  const active = sites.find((s) => s.id === site);
  const phase = moonPhaseDeg(epochMs);
  const illum = Math.round((1 - Math.cos((phase * Math.PI) / 180)) * 50);
  const rel = moonPositionKm(epochMs);
  const distanceKm = Math.hypot(...rel);
  if (cleanView) return null;
  return (
    <>
      <section className="plate" aria-live="polite">
        <p className="kicker">{active ? `${active.agency} · ${active.date}` : 'Our celestial companion'}</p>
        <h1 key={active?.id ?? preset}>
          {active ? active.name : preset === 'far' ? 'The far side.' : preset === 'south' ? 'Toward the pole.' : preset === 'terminator' ? 'Light and shadow.' : 'Another world, within reach.'}
        </h1>
        <p className="dek">
          {active ? active.blurb : 'A landscape written by impacts, a record of the early Solar System preserved in stone. Lit exactly as it is right now.'}
        </p>
        {active?.crew && <p className="mt-2 text-xs text-fog-2">Crew on the surface: {active.crew.join(', ')} · {active.region}</p>}
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          {PRESETS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={preset === p.id && !site} onClick={() => set({ preset: p.id, site: null, tour: false })}>
              {p.label}
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
          <span className="kicker">Sunlight</span>
          <input type="range" min={0} max={1} step={0.005} value={sunlight ?? 0.5} onChange={(e) => set({ sunlight: Number(e.target.value) })} aria-label="Sunlight sweep" className="w-40" />
          <button className="chip" onClick={() => set({ sunlight: null })} aria-pressed={sunlight === null}>
            Real sun
          </button>
        </label>
      </section>
      <aside className="card drawer hidden md:block" data-ui data-testid="moon-panel">
        <p className="kicker">Right now</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums">{Math.round(distanceKm).toLocaleString()} km</p>
        <p className="text-xs text-fog-2">from Earth, centre to centre</p>
        <p className="kicker mt-2" data-testid="moon-lighting">{sunlight === null ? 'Real illumination' : 'Illustrative lighting'}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="kicker">Phase</dt>
            <dd className="mt-0.5">{illum}% lit</dd>
          </div>
          <div>
            <dt className="kicker">Radius</dt>
            <dd className="mt-0.5">1,737.4 km</dd>
          </div>
          <div>
            <dt className="kicker">Gravity</dt>
            <dd className="mt-0.5">1.62 m/s²</dd>
          </div>
          <div>
            <dt className="kicker">Atmosphere</dt>
            <dd className="mt-0.5">None</dd>
          </div>
        </dl>
        <p className="text-xs text-fog-2 mt-3">NASA LROC colour + LOLA relief · Earth distance compressed for composition · Drag to orbit</p>
      </aside>
    </>
  );
}
