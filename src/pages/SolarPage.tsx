import { useEffect, useState } from 'react';
import { useExperience } from '@/app/EngineContext';
import { SolarExperience } from '@/experiences/solar/SolarExperience';
import { solarStore, useSolar, type SolarView } from '@/store/solar';
import { BODIES, BODY_BY_ID, bodyInfo, moonsOf, PLANETS, type BodyInfo } from '@/astro/bodies';
import { anyBodyInfo, CRAFT_BY_ID, isCraft } from '@/astro/spacecraft';
import { AU_KM } from '@/astro/scale';
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
    if (body && (BODIES.some((b) => b.id === body) || isCraft(body))) patch.focus = body;
    if (view && VIEWS.some((v) => v.id === view)) patch.view = view;
    else if (body) patch.view = 'planet';
    if (p.get('scale') === 'true') patch.trueScale = true;
    if (p.get('paths') === '0') patch.paths = false;
    if (p.get('craft') === '0') patch.crafts = false;
    solarStore.setState(patch);
  }, []);
  useExperience('solar', factory);

  const view = useSolar((s) => s.view);
  const focus = useSolar((s) => s.focus);
  const trueScale = useSolar((s) => s.trueScale);
  const paths = useSolar((s) => s.paths);
  const tour = useSolar((s) => s.tour);
  const crafts = useSolar((s) => s.crafts);
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
      if (!crafts) p.set('craft', '0');
      else p.delete('craft');
    });
  }, [focus, view, trueScale, paths, crafts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey) return;
      if (e.shiftKey && e.key.startsWith('Arrow')) return; // Shift+arrows orbit the camera (global)
      const s = solarStore.getState();
      const order = PLANETS.map((p) => p.id);
      const cur = anyBodyInfo(s.focus, BODY_BY_ID);
      const idx = order.indexOf(!cur || cur.kind === 'star' || cur.kind === 'craft' ? '' : cur.kind === 'moon' ? cur.parent! : s.focus);
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

  const info: BodyInfo = anyBodyInfo(focus, BODY_BY_ID) ?? bodyInfo('sun');
  const moons = info.kind === 'craft' ? [] : moonsOf(info.kind === 'moon' ? info.parent! : focus);
  const headline = view === 'compare' ? 'Side by side.' : view === 'system' ? 'Everything in motion.' : view === 'inner' ? 'Our stellar neighborhood.' : view === 'moons' ? `${bodyInfo(info.kind === 'moon' ? info.parent! : focus).name} & its moons.` : `${info.name}.`;
  const craft = CRAFT_BY_ID.get(focus);
  const kicker = view === 'compare' ? 'True relative sizes' : view === 'system' ? 'Beyond our world' : view === 'inner' ? 'The rocky worlds' : craft ? (craft.kind === 'probe' ? `Spacecraft · ${craft.agency}` : craft.kind) : info.kind === 'moon' ? `Moon of ${bodyInfo(info.parent!).name}` : info.kind;

  if (cleanView) return null;
  return (
    <>
      <section className="plate" aria-live="polite">
        <p className="kicker">{kicker}</p>
        <h1 key={headline}>
          {headline}
        </h1>
        <p className="dek">{view === 'compare' ? 'Every world at its true radius, in a row. The Sun on the left is 109 Earths wide; drag to see how little of it fits.' : view === 'system' ? 'Eight worlds. One star. Real positions for any date you choose.' : info.tagline}</p>
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
          <button className="chip" aria-pressed={crafts} onClick={() => set.setCrafts(!crafts)} data-testid="crafts-toggle">
            Spacecraft
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
        <Moments />
      </section>
      <InfoPanel id={focus} />
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
    <div className="plate-row" data-ui data-testid="moments">
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
  const craft = CRAFT_BY_ID.get(id);
  const info: BodyInfo = anyBodyInfo(id, BODY_BY_ID) ?? bodyInfo('sun');
  const t = useSolar((s) => s.telemetry);
  if (craft) {
    const years = craft.launch ? (Date.now() - Date.parse(craft.launch)) / (365.25 * 86_400_000) : null;
    const lightMin = t.earthDistanceKm / 299_792.458 / 60;
    return (
      <aside className="card drawer hidden md:block" data-ui aria-label={`${craft.name} facts`} data-testid="info-panel">
        <p className="kicker">{craft.kind === 'probe' ? `Spacecraft · ${craft.agency}` : craft.kind}</p>
        <h2 className="text-2xl font-semibold mt-1">{craft.name}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {craft.launch && <Stat k="Launched" v={craft.launch} />}
          {years !== null && <Stat k="In flight" v={`${fmt(years, 1)} yr`} />}
          <Stat k="Speed" v={t.speedKmS > 0 ? `${fmt(t.speedKmS, 2)} km/s` : '—'} />
          <Stat k="From Sun" v={t.sunDistanceKm > 0 ? `${fmt(t.sunDistanceKm / AU_KM, 3)} AU` : '—'} />
          <Stat k="From Earth" v={t.earthDistanceKm > 0 ? `${fmt(t.earthDistanceKm / AU_KM, 3)} AU` : '—'} />
          <Stat k="Signal time" v={lightMin > 0 ? (lightMin > 60 ? `${fmt(lightMin / 60, 1)} h` : `${fmt(lightMin, 1)} min`) : '—'} />
        </dl>
        <ul className="mt-3 space-y-1.5 text-fog-2 text-xs leading-relaxed">
          {craft.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-fog-2">Path from NASA/JPL Horizons samples, drawn up to the simulation date.</p>
      </aside>
    );
  }
  const lightSeconds = t.sunDistanceKm / 299_792.458;
  return (
    <aside className="card drawer hidden md:block" data-ui aria-label={`${info.name} facts`} data-testid="info-panel">
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
      <dt className="kicker">
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
