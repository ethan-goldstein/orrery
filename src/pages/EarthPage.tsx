import { useEffect, useMemo, useRef } from 'react';
import { useEngine, useExperience } from '@/app/EngineContext';
import { EarthExperience, clampMa } from '@/experiences/earth/EarthExperience';
import { ERA_KIND_LABEL, ERAS, eraAt, formatAge, maToSlider, sliderToMa } from '@/experiences/earth/eras';
import { earthStore, useEarth } from '@/store/earth';
import { useExperience as useExperienceState } from '@/store/experience';
import { writeUrl } from '@/app/url-state';

let current: EarthExperience | null = null;
const factory = () => (current = new EarthExperience());

export default function EarthPage() {
  useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const ma = Number(p.get('ma'));
    const light = p.get('light');
    const patch: Partial<ReturnType<typeof earthStore.getState>> = {};
    if (Number.isFinite(ma) && p.get('ma') !== null) patch.ma = clampMa(ma);
    if (light === 'natural' || light === 'night' || light === 'blue') patch.light = light;
    const sun = p.get('sun');
    if (sun !== null && Number.isFinite(Number(sun))) patch.sunHour = Number(sun);
    earthStore.setState(patch);
  }, []);
  useExperience('earth', factory);
  const engine = useEngine();
  const ma = useEarth((s) => s.ma);
  const playing = useEarth((s) => s.playing);
  const speed = useEarth((s) => s.speed);
  const light = useEarth((s) => s.light);
  const sunHour = useEarth((s) => s.sunHour);
  const clouds = useEarth((s) => s.clouds);
  const rotate = useEarth((s) => s.rotate);
  const compare = useEarth((s) => s.compare);
  const cleanView = useExperienceState((s) => s.cleanView);
  const set = earthStore.getState().set;
  const era = eraAt(ma);
  const transitioning = Math.abs(era.ma - ma) > Math.max(3, era.ma * 0.06);
  const lastFly = useRef<string>('');
  const maBucket = Math.round(ma / 5);

  useEffect(() => {
    writeUrl((p) => {
      p.set('ma', ma.toFixed(0));
      if (light !== 'natural') p.set('light', light);
      else p.delete('light');
      if (sunHour !== null) p.set('sun', sunHour.toFixed(1));
      else p.delete('sun');
    });
  }, [maBucket, light, sunHour]);

  useEffect(() => {
    // fly the camera to each era's viewpoint when the story lands on it
    if (!transitioning && lastFly.current !== era.id && current) {
      lastFly.current = era.id;
      current.flyToEra(era.lat, era.lon);
    }
  }, [era.id, transitioning]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey) return;
      const s = earthStore.getState();
      const sorted = [...ERAS].sort((a, b) => b.ma - a.ma);
      const idx = sorted.findIndex((x) => x.id === eraAt(s.ma).id);
      switch (e.key) {
        case ' ':
          e.preventDefault();
          e.stopImmediatePropagation();
          s.set({ playing: !s.playing, ...(s.ma < 1 && !s.playing ? { ma: 4540 } : {}) });
          break;
        case 'ArrowLeft':
          s.set({ ma: sorted[Math.max(0, idx - 1)]!.ma, playing: false });
          break;
        case 'ArrowRight':
          s.set({ ma: sorted[Math.min(sorted.length - 1, idx + 1)]!.ma, playing: false });
          break;
        case 'Home':
          s.set({ ma: 4540, playing: false });
          break;
        case 'End':
          s.set({ ma: 0, playing: false });
          break;
        case 'c':
        case 'C':
          s.set({ compare: !s.compare });
          break;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (cleanView) return null;
  const kindLabel = compare ? 'Present-day comparison' : transitioning ? 'Illustrative transition' : ERA_KIND_LABEL[era.kind];
  const lightingLabel = sunHour === null && ma < 0.5 ? 'Real sun for this date' : 'Art-directed illumination';
  void engine;
  return (
    <>
      <section className="p-5 md:p-8 max-w-md pointer-events-none" aria-live="polite">
        <p className="kicker">{era.period} · {kindLabel}</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-2" key={era.id}>
          {era.headline}
        </h1>
        <p className="mt-2 text-fog-2 leading-relaxed">{era.story}</p>
        <p className="mt-3 text-xs text-fog-2">
          Source:{' '}
          <a href={era.source.url} target="_blank" rel="noopener noreferrer" className="underline pointer-events-auto" data-ui>
            {era.source.name}
          </a>
        </p>
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          <button className="chip" onClick={() => set({ ma: 4540, playing: true })} data-testid="play-story">
            {playing ? 'Ⅱ Pause story' : '▶ Play Earth’s history'}
          </button>
          <button className="chip" onClick={() => set({ speed: [0.5, 1, 2, 3, 5][([0.5, 1, 2, 3, 5].indexOf(speed) + 1) % 5]! })} aria-label="Playback speed">
            {speed}×
          </button>
          <button className="chip" aria-pressed={compare} onClick={() => set({ compare: !compare })} title="C">
            {compare ? 'Return to the past' : 'Compare with today'}
          </button>
          <button className="chip" onClick={() => set({ ma: 0, playing: false })}>
            Back to today
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" data-ui>
          {(['natural', 'night', 'blue'] as const).map((l) => (
            <button key={l} className="chip" aria-pressed={light === l} onClick={() => set({ light: l })}>
              {l === 'natural' ? 'Natural' : l === 'night' ? 'After dark' : 'Blue hour'}
            </button>
          ))}
          <button className="chip" aria-pressed={clouds} onClick={() => set({ clouds: !clouds })}>
            Clouds
          </button>
          <button className="chip" aria-pressed={rotate} onClick={() => set({ rotate: !rotate })}>
            Rotation
          </button>
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker">Sunlight</span>
          <input type="range" min={0} max={24} step={0.1} value={sunHour ?? 12} onChange={(e) => set({ sunHour: Number(e.target.value) })} aria-label="Sun position, dawn to dusk" className="w-40" />
          <button className="chip" onClick={() => set({ sunHour: null })} aria-pressed={sunHour === null}>
            Real sun
          </button>
        </label>
      </section>
      <aside className="panel fixed right-4 top-20 w-64 p-4 hidden md:block" data-ui>
        <p className="kicker">Time readout</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums" data-testid="age-readout">
          {formatAge(ma)}
        </p>
        <p className="kicker mt-3">{era.title}</p>
        <p className="text-xs text-fog-2 mt-1" data-testid="earth-lighting">{lightingLabel} · not a live clock</p>
        <p className="text-xs text-fog-2 mt-1">Scroll to travel · ← → jump eras · Space plays · C compares · H hides the interface</p>
        <div className="mt-3 flex gap-2">
          <button className="chip" onClick={() => current?.zoom(0.8)} aria-label="Zoom in">
            +
          </button>
          <button className="chip" onClick={() => current?.zoom(1.25)} aria-label="Zoom out">
            −
          </button>
        </div>
      </aside>
      <Timeline ma={ma} />
    </>
  );
}

function Timeline({ ma }: { ma: number }) {
  const set = earthStore.getState().set;
  const sorted = [...ERAS].sort((a, b) => b.ma - a.ma);
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-8 md:right-8" data-ui data-testid="timeline">
      <div className="panel px-4 py-3">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(maToSlider(ma) * 1000)}
          onChange={(e) => set({ ma: sliderToMa(Number(e.target.value) / 1000), playing: false })}
          aria-label="Earth history timeline"
          className="w-full"
        />
        <ol className="mt-1 flex justify-between text-[10px] text-fog-2">
          {sorted.map((e) => (
            <li key={e.id}>
              <button className={`hover:text-fog ${eraAt(ma).id === e.id ? 'text-glow' : ''}`} onClick={() => set({ ma: e.ma, playing: false })} data-era={e.id}>
                {e.fact === 'Now' ? 'Today' : `${e.fact} ${e.factLabel.startsWith('billion') ? 'Ga' : 'Ma'}`}
              </button>
            </li>
          ))}
        </ol>
        <p className="kicker mt-1" style={{ fontSize: '0.55rem' }}>
          Formation ──── present · event spacing is not linear · Ga = billion years, Ma = million years
        </p>
      </div>
    </div>
  );
}
