import { useEffect, useState } from 'react';
import { useExperience } from '@/app/EngineContext';
import { SolarExperience } from '@/experiences/solar/SolarExperience';
import { solarStore, useSolar, type SolarView } from '@/store/solar';
import { BODIES, bodyInfo, moonsOf, PLANETS } from '@/astro/bodies';
import { AU_KM } from '@/astro/scale';
import { assetUrl, loadManifest, type Manifest } from '@/engine/Assets';
import { useExperience as useExperienceState } from '@/store/experience';
import { writeUrl } from '@/app/url-state';
import { upcomingEvents, type AstroEvent } from '@/astro/events';
import { clockStore, useClock } from '@/store/clock';

const factory = () => new SolarExperience();

const VIEWS: { id: SolarView; label: string }[] = [
  { id: 'system', label: 'Solar System' },
  { id: 'planet', label: 'Planet' },
  { id: 'moons', label: 'Moons' },
  { id: 'inner', label: 'Inner worlds' },
  { id: 'compare', label: 'Compare sizes' },
];

export default function SolarPage() {
  // read deep link before the experience mounts
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const body = p.get('body');
    const view = p.get('view') as SolarView | null;
    const patch: Partial<ReturnType<typeof solarStore.getState>> = {};
    if (body && BODIES.some((b) => b.id === body)) patch.focus = body;
    if (view && VIEWS.some((v) => v.id === view)) patch.view = view;
    else if (body) patch.view = 'planet';
    if (p.get('scale') === 'true') patch.trueScale = true;
    if (p.get('paths') === '0') patch.paths = false;
    solarStore.setState(patch);
  }, []);
  useExperience('solar', factory);

  const view = useSolar((s) => s.view);
  const focus = useSolar((s) => s.focus);
  const trueScale = useSolar((s) => s.trueScale);
  const paths = useSolar((s) => s.paths);
  const tour = useSolar((s) => s.tour);
  const cleanView = useExperienceState((s) => s.cleanView);
  const set = solarStore.getState();

  useEffect(() => {
    writeUrl((p) => {
      p.set('body', focus);
      p.set('view', view);
      if (trueScale) p.set('scale', 'true');
      else p.delete('scale');
      if (!paths) p.set('paths', '0');
      else p.delete('paths');
    });
  }, [focus, view, trueScale, paths]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey) return;
      const s = solarStore.getState();
      const order = PLANETS.map((p) => p.id);
      const idx = order.indexOf(s.focus === 'sun' ? '' : (bodyInfo(s.focus).kind === 'moon' ? bodyInfo(s.focus).parent! : s.focus));
      switch (e.key) {
        case 'Escape':
          s.setTour(false);
          s.setFocus('sun', 'system');
          break;
        case 'ArrowRight':
        case '.':
          s.setFocus(order[(idx + 1 + order.length) % order.length]!, 'planet');
          break;
        case 'ArrowLeft':
        case ',':
          s.setFocus(order[(idx - 1 + order.length) % order.length]!, 'planet');
          break;
        case 's':
        case 'S':
          s.setTrueScale(!s.trueScale);
          break;
        case 'p':
        case 'P':
          s.setPaths(!s.paths);
          break;
        case 't':
        case 'T':
          s.setTour(!s.tour);
          break;
        case 'm':
        case 'M':
          s.setView(s.view === 'moons' ? 'planet' : 'moons');
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const p = PLANETS[Number(e.key) - 1];
            if (p) s.setFocus(p.id, 'planet');
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const info = bodyInfo(focus);
  const moons = moonsOf(info.kind === 'moon' ? info.parent! : focus);
  const headline = view === 'compare' ? 'Side by side.' : view === 'system' ? 'Everything in motion.' : view === 'inner' ? 'Our stellar neighborhood.' : view === 'moons' ? `${bodyInfo(info.kind === 'moon' ? info.parent! : focus).name} & its moons.` : `${info.name}.`;
  const kicker = view === 'compare' ? 'True relative sizes' : view === 'system' ? 'Beyond our world' : view === 'inner' ? 'The rocky worlds' : info.kind === 'moon' ? `Moon of ${bodyInfo(info.parent!).name}` : info.kind;

  if (cleanView) return null;
  return (
    <>
      <section className="p-5 md:p-8 max-w-md pointer-events-none" aria-live="polite">
        <p className="kicker">{kicker}</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-2 transition-opacity" key={headline}>
          {headline}
        </h1>
        <p className="mt-2 text-fog-2">{view === 'compare' ? 'Every world at its true radius, in a row. The Sun on the left is 109 Earths wide; drag to see how little of it fits.' : view === 'system' ? 'Eight worlds. One star. Real positions for any date you choose.' : info.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          {VIEWS.map((v) => (
            <button key={v.id} className="chip" aria-pressed={view === v.id} onClick={() => set.setView(v.id)} disabled={v.id === 'moons' && moons.length === 0} style={v.id === 'moons' && moons.length === 0 ? { opacity: 0.4 } : undefined}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" data-ui>
          <button className="chip" aria-pressed={trueScale} onClick={() => set.setTrueScale(!trueScale)} title="S">
            {trueScale ? 'True scale' : 'Illustrated scale'} <span aria-hidden>↔</span>
          </button>
          <button className="chip" aria-pressed={paths} onClick={() => set.setPaths(!paths)} title="P">
            Orbital paths
          </button>
          <button className="chip" aria-pressed={tour} onClick={() => set.setTour(!tour)} title="T">
            {tour ? 'Stop tour' : 'Grand tour'}
          </button>
          {moons.length > 0 && (
            <select className="chip bg-ink-2" aria-label="Explore a moon" value={info.kind === 'moon' ? focus : ''} onChange={(e) => e.target.value && set.setFocus(e.target.value, 'planet')}>
              <option value="">Explore a moon ({moons.length})</option>
              {moons.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>
      <Moments />
      <InfoPanel id={focus} />
      <PlanetStrip />
    </>
  );
}

/** Jump-to buttons for the next eclipse, full moon and season; the renderer's eclipse shadows do the rest. */
function Moments() {
  const epochMs = useClock((s) => s.epochMs);
  const day = Math.floor(epochMs / 86_400_000);
  const [events, setEvents] = useState<AstroEvent[]>([]);
  useEffect(() => {
    try {
      setEvents(upcomingEvents(epochMs));
    } catch {
      setEvents([]);
    }
  }, [day]);
  if (events.length === 0) return null;
  const go = (e: AstroEvent) => {
    clockStore.getState().setEpoch(e.ms);
    clockStore.getState().setRate(60);
    solarStore.getState().setFocus(e.focus, 'planet');
  };
  return (
    <div className="fixed left-5 md:left-8 bottom-44 md:bottom-40 flex flex-wrap gap-2 max-w-md" data-ui data-testid="moments">
      <span className="kicker self-center">Moments</span>
      {events.map((e) => (
        <button key={e.id} className="chip" onClick={() => go(e)} title={e.detail} data-event={e.id}>
          {e.label}
        </button>
      ))}
    </div>
  );
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function InfoPanel({ id }: { id: string }) {
  const info = bodyInfo(id);
  const t = useSolar((s) => s.telemetry);
  const lightSeconds = t.sunDistanceKm / 299_792.458;
  return (
    <aside className="panel fixed right-4 top-20 w-72 max-w-[calc(100vw-2rem)] p-4 text-sm hidden md:block" data-ui aria-label={`${info.name} facts`} data-testid="info-panel">
      <p className="kicker">{info.kind === 'moon' ? `Moon of ${bodyInfo(info.parent!).name}` : info.kind}</p>
      <h2 className="text-2xl font-semibold mt-1">{info.name}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Stat k="Radius" v={`${fmt(info.radiusKm)} km`} />
        <Stat k="Gravity" v={info.gravity !== null ? `${info.gravity} m/s²` : '—'} />
        <Stat k="Day" v={info.dayHours ? (Math.abs(info.dayHours) > 48 ? `${fmt(Math.abs(info.dayHours) / 24, 1)} d${info.dayHours < 0 ? ' (retro)' : ''}` : `${fmt(Math.abs(info.dayHours), 1)} h${info.dayHours < 0 ? ' (retro)' : ''}`) : '—'} />
        <Stat k="Year" v={info.periodDays ? (Math.abs(info.periodDays) > 400 ? `${fmt(Math.abs(info.periodDays) / 365.25, 1)} yr` : `${fmt(Math.abs(info.periodDays), 2)} d`) : '—'} />
        <Stat k="Temp" v={info.temperatureK !== null ? `${info.temperatureK} K · ${fmt(info.temperatureK - 273.15)} °C` : '—'} />
        <Stat k="Mass" v={`${info.massKg.toExponential(2).replace('e+', ' × 10^')} kg`} />
        {info.kind !== 'star' && <Stat k="From Sun" v={t.sunDistanceKm > 0 ? `${fmt(t.sunDistanceKm / AU_KM, 3)} AU` : '—'} />}
        {info.kind !== 'star' && <Stat k="Light time" v={lightSeconds > 0 ? (lightSeconds > 3600 ? `${fmt(lightSeconds / 3600, 2)} h` : `${fmt(lightSeconds / 60, 1)} min`) : '—'} />}
        {info.kind === 'moon' && <Stat k={`From ${bodyInfo(info.parent!).name}`} v={`${fmt(t.parentDistanceKm)} km`} />}
        {id === 'moon' && <Stat k="Phase" v={phaseName(t.moonPhaseDeg)} />}
        <Stat k="Camera" v={t.cameraAltitudeKm > 0 ? `${fmt(t.cameraAltitudeKm)} km up` : '—'} />
      </dl>
      <ul className="mt-3 space-y-1.5 text-fog-2 text-xs leading-relaxed">
        {info.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </aside>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="kicker" style={{ fontSize: '0.58rem' }}>
        {k}
      </dt>
      <dd className="font-mono tabular-nums mt-0.5">{v}</dd>
    </div>
  );
}

function phaseName(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  if (d < 22.5 || d >= 337.5) return 'New';
  if (d < 67.5) return 'Waxing crescent';
  if (d < 112.5) return 'First quarter';
  if (d < 157.5) return 'Waxing gibbous';
  if (d < 202.5) return 'Full';
  if (d < 247.5) return 'Waning gibbous';
  if (d < 292.5) return 'Last quarter';
  return 'Waning crescent';
}

function PlanetStrip() {
  const focus = useSolar((s) => s.focus);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    loadManifest().then(setManifest).catch(() => undefined);
  }, []);
  const thumb = (textureId: string | null) => {
    const e = manifest?.textures.find((t) => t.id === textureId);
    const f = e?.files['1k']?.webp;
    return f ? `url(${assetUrl(f)})` : undefined;
  };
  const items = [bodyInfo('sun'), ...PLANETS, bodyInfo('pluto')];
  return (
    <nav className="fixed bottom-20 left-4 right-4 flex justify-center pointer-events-none" aria-label="Worlds">
      <ul className="flex gap-1 overflow-x-auto panel px-2 py-1.5 pointer-events-auto max-w-full" data-ui data-testid="planet-strip">
        {items.map((b) => (
          <li key={b.id}>
            <button
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg hover:bg-fog/10"
              aria-pressed={focus === b.id}
              onClick={() => solarStore.getState().setFocus(b.id, b.id === 'sun' ? 'planet' : 'planet')}
              data-body={b.id}
            >
              <span className="picker-thumb" style={{ backgroundImage: thumb(b.texture), backgroundColor: b.color, boxShadow: focus === b.id ? '0 0 0 2px var(--color-glow), inset -6px -4px 10px rgba(0,0,0,0.65)' : undefined }} aria-hidden />
              <span className={`text-[11px] ${focus === b.id ? 'text-glow' : 'text-fog-2'}`}>{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
