import { useEffect, useState } from 'react';
import { useExperience } from '@/app/EngineContext';
import { OrbitExperience } from '@/experiences/orbit/OrbitExperience';
import { orbitStore, useOrbit, type OrbitGroup } from '@/store/orbit';
import { useExperience as useExperienceState } from '@/store/experience';
import { writeUrl } from '@/app/url-state';

let current: OrbitExperience | null = null;
const factory = () => (current = new OrbitExperience());

const GROUPS: { id: OrbitGroup; label: string; blurb: string }[] = [
  { id: 'leo', label: 'Near Earth', blurb: 'Below 2,000 km: the station, Starlink, most Earth observation.' },
  { id: 'meo', label: 'Middle orbit', blurb: 'Navigation constellations at 20,000 km: GPS, Galileo, GLONASS, BeiDou.' },
  { id: 'geo', label: 'Geosynchronous', blurb: '35,786 km up, matching Earth’s spin: weather and communications.' },
  { id: 'all', label: 'All orbits', blurb: 'Everything we track at once.' },
];

export default function OrbitPage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const patch: Partial<ReturnType<typeof orbitStore.getState>> = {};
    const sat = Number(p.get('sat'));
    if (p.get('sat') && Number.isFinite(sat)) {
      patch.selected = sat;
      patch.follow = p.get('follow') !== '0';
    }
    const group = p.get('group') as OrbitGroup | null;
    if (group && GROUPS.some((g) => g.id === group)) patch.group = group;
    const year = Number(p.get('year'));
    if (p.get('year') && Number.isFinite(year)) patch.year = year;
    if (p.get('debris') === '1') patch.debris = true;
    orbitStore.setState(patch);
  }, []);
  useExperience('orbit', factory);
  const group = useOrbit((s) => s.group);
  const debris = useOrbit((s) => s.debris);
  const paths = useOrbit((s) => s.paths);
  const selected = useOrbit((s) => s.selected);
  const follow = useOrbit((s) => s.follow);
  const year = useOrbit((s) => s.year);
  const playing = useOrbit((s) => s.playingTimeline);
  const visible = useOrbit((s) => s.visibleCount);
  const total = useOrbit((s) => s.totalCount);
  const info = useOrbit((s) => s.selectedInfo);
  const snapshot = useOrbit((s) => s.snapshot);
  const cleanView = useExperienceState((s) => s.cleanView);
  const set = orbitStore.getState().set;
  const [query, setQuery] = useState('');
  const yearInt = Math.round(year);
  const results = query ? (current?.search(query) ?? []) : [];

  useEffect(() => {
    writeUrl((p) => {
      p.set('group', group);
      if (selected !== null) p.set('sat', String(selected));
      else p.delete('sat');
      if (selected !== null && !follow) p.set('follow', '0');
      else p.delete('follow');
      if (Math.round(year) !== new Date().getUTCFullYear()) p.set('year', String(Math.round(year)));
      else p.delete('year');
      if (debris) p.set('debris', '1');
      else p.delete('debris');
    });
  }, [group, selected, follow, yearInt, debris]);

  if (cleanView) return null;
  const g = GROUPS.find((x) => x.id === group)!;
  return (
    <>
      <section className="plate" aria-live="polite">
        <p className="kicker">{info ? `${info.type} · ${info.owner || 'unknown owner'} · launched ${info.launch || '?'}` : 'A world in orbit'}</p>
        <h1 key={info?.id ?? group}>
          {info ? info.name : 'Thousands of spacecraft. One shared sky.'}
        </h1>
        <p className="dek">
          {info ? `${Math.round(info.altKm).toLocaleString()} km up, ${info.speedKmS.toFixed(2)} km/s, one orbit every ${info.periodMin.toFixed(0)} minutes, inclined ${info.incl.toFixed(1)}°.` : g.blurb}
        </p>
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          {GROUPS.map((x) => (
            <button key={x.id} className="chip" aria-pressed={group === x.id} onClick={() => set({ group: x.id })}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" data-ui>
          <button className="chip" aria-pressed={debris} onClick={() => set({ debris: !debris })}>
            Debris &amp; rockets
          </button>
          <button className="chip" aria-pressed={paths} onClick={() => set({ paths: !paths })}>
            Orbit path
          </button>
          <button className="chip" aria-pressed={follow} onClick={() => set({ selected: 25544, follow: !follow || selected !== 25544, group: 'leo' })} data-testid="find-iss">
            {follow && selected === 25544 ? 'Following the ISS' : 'Find the ISS'}
          </button>
          {selected !== null && (
            <button className="chip" onClick={() => set({ selected: null, follow: false })}>
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 relative" data-ui>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a satellite (name or NORAD id)" aria-label="Find a satellite" className="chip w-72" data-testid="sat-search" />
          {results.length > 0 && (
            <ul className="panel absolute z-10 mt-1 w-72 max-h-60 overflow-y-auto text-sm" role="listbox">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-fog/10"
                    onClick={() => {
                      set({ selected: r.id, follow: true, debris: r.type >= 1 ? true : debris });
                      setQuery('');
                    }}
                  >
                    {r.name} <span className="text-fog-2 text-xs">· {r.id} · {r.launch || '?'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker w-28">Space age · {Math.round(year)}</span>
          <input type="range" min={1957} max={new Date().getUTCFullYear()} step={1} value={Math.round(year)} onChange={(e) => set({ year: Number(e.target.value), playingTimeline: false })} aria-label="Launched by year" className="w-48" data-testid="year-scrub" />
          <button className="chip" onClick={() => set(playing ? { playingTimeline: false } : { year: 1957, playingTimeline: true })}>
            {playing ? 'Ⅱ' : '▶ Play the space age'}
          </button>
        </label>
      </section>
      <aside className="card drawer" data-ui data-testid="orbit-panel">
        <p className="text-3xl font-semibold tabular-nums">{visible.toLocaleString()}</p>
        <p className="kicker">plotted objects</p>
        <p className="text-xs text-fog-2 mt-1">
          of {total.toLocaleString()} tracked · CelesTrak snapshot <span data-testid="orbit-snapshot">{snapshot || '…'}</span> · SGP4
        </p>
        <ul className="mt-3 text-xs space-y-1">
          <li>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'rgb(255,209,115)' }} />
            Payloads
          </li>
          <li>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'rgb(250,128,77)' }} />
            Rocket bodies
          </li>
          <li>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'rgb(140,153,191)' }} />
            Debris
          </li>
        </ul>
        <p className="text-xs text-fog-2 mt-3">Positions are propagated live from a dated element set; they drift by kilometres per day. Drag to rotate, select any point.</p>
      </aside>
    </>
  );
}
