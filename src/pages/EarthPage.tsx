import { useEffect, useRef } from 'react';
import { useEngine, useExperience } from '@/app/EngineContext';
import { EarthExperience, clampMa } from '@/experiences/earth/EarthExperience';
import { ERA_KIND_LABEL, ERAS, eraAt, formatAge } from '@/experiences/earth/eras';
import { earthStore, useEarth } from '@/store/earth';
import { useExperience as useExperienceState } from '@/store/experience';
import { writeUrl } from '@/app/url-state';

let current: EarthExperience | null = null;
const factory = () => (current = new EarthExperience());

export default function EarthPage() {
  useEffect(() => {
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
      if (e.shiftKey && e.key.startsWith('Arrow')) return; // Shift+arrows orbit the camera (global)
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
      <section className="plate" aria-live="polite">
        <p className="kicker">{era.period} · {kindLabel}</p>
        <h1 key={era.id}>
          {era.headline}
        </h1>
        <p className="dek">{era.story}</p>
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
      <aside className="card drawer" data-ui>
        <p className="kicker">Time readout</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums" data-testid="age-readout">
          {formatAge(ma)}
        </p>
        <p className="kicker mt-3">{era.title}</p>
        <p className="text-xs text-fog-2 mt-1" data-testid="earth-lighting">{lightingLabel} · not a live clock</p>
        <p className="text-xs text-fog-2 mt-1">Shift+scroll or drag the timeline to travel · ← → jump eras · Space plays · C compares · H hides the interface</p>
      </aside>
    </>
  );
}
