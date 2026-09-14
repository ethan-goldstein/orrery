import { useEffect } from 'react';
import { useExperience } from '@/app/EngineContext';
import { OceansExperience } from '@/experiences/oceans/OceansExperience';
import { oceanStore, useOceans, type OceanPreset } from '@/store/oceans';
import { useExperience as useExperienceState } from '@/store/experience';
import { writeUrl } from '@/app/url-state';

let current: OceansExperience | null = null;
const factory = () => (current = new OceansExperience());

const PRESETS: { id: OceanPreset; label: string; headline: string; blurb: string }[] = [
  { id: 'planet', label: 'Ocean planet', headline: 'An ocean. Always moving.', blurb: 'Beneath a familiar blue surface, water is on the move. Follow the currents that connect our ocean basins.' },
  { id: 'gulf', label: 'Gulf Stream', headline: 'A river in the sea.', blurb: 'The Gulf Stream carries warm water north along America’s coast at up to 2.5 m/s, then spreads across the Atlantic toward Europe.' },
  { id: 'pacific', label: 'Pacific', headline: 'Half the planet.', blurb: 'The North and South Pacific gyres turn in opposite directions around the equatorial currents, sorting heat, nutrients and plastic.' },
  { id: 'southern', label: 'Southern Ocean', headline: 'The current that circles the world.', blurb: 'The Antarctic Circumpolar Current links every ocean, moving more water than all the world’s rivers combined, a hundred times over.' },
];

export default function OceansPage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const preset = p.get('preset') as OceanPreset | null;
    const patch: Partial<ReturnType<typeof oceanStore.getState>> = {};
    if (preset && PRESETS.some((x) => x.id === preset)) patch.preset = preset;
    const reveal = Number(p.get('reveal'));
    if (p.get('reveal') && Number.isFinite(reveal)) patch.reveal = Math.min(1, Math.max(0, reveal));
    oceanStore.setState(patch);
  }, []);
  useExperience('oceans', factory);
  const preset = useOceans((s) => s.preset);
  const playing = useOceans((s) => s.playing);
  const reveal = useOceans((s) => s.reveal);
  const speed = useOceans((s) => s.speed);
  const count = useOceans((s) => s.particleCount);
  const cleanView = useExperienceState((s) => s.cleanView);
  const set = oceanStore.getState().set;
  const p = PRESETS.find((x) => x.id === preset)!;

  useEffect(() => {
    writeUrl((q) => {
      q.set('preset', preset);
      q.set('reveal', reveal.toFixed(2));
    });
  }, [preset, reveal]);

  if (cleanView) return null;
  return (
    <>
      <section className="p-5 md:p-8 max-w-md pointer-events-none" aria-live="polite">
        <p className="kicker">A planet connected by water</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-2" key={preset}>
          {p.headline}
        </h1>
        <p className="mt-2 text-fog-2 leading-relaxed">{p.blurb}</p>
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          {PRESETS.map((x) => (
            <button key={x.id} className="chip" aria-pressed={preset === x.id} onClick={() => set({ preset: x.id })}>
              {x.label}
            </button>
          ))}
          <button className="chip" onClick={() => set({ playing: !playing })} data-testid="oceans-play">
            {playing ? 'Ⅱ Pause' : '▶ Play'}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker w-24">Reveal currents</span>
          <input type="range" min={0} max={1} step={0.01} value={reveal} onChange={(e) => set({ reveal: Number(e.target.value) })} aria-label="Reveal currents" className="w-48" data-testid="reveal" />
        </label>
        <label className="mt-2 flex items-center gap-3 text-xs" data-ui>
          <span className="kicker w-24">Speed</span>
          <input type="range" min={0.25} max={3} step={0.25} value={speed} onChange={(e) => set({ speed: Number(e.target.value) })} aria-label="Playback speed" className="w-48" />
        </label>
      </section>
      <aside className="panel fixed right-4 top-20 w-64 p-4 hidden md:block" data-ui data-testid="oceans-panel">
        <p className="text-2xl font-semibold">One connected ocean</p>
        <p className="kicker mt-1">Surface currents · 26 Sep 2014</p>
        <p className="text-xs text-fog-2 mt-2">{count.toLocaleString()} particles advected through the OSCAR velocity field. Trails accelerated: one real second is about ten hours.</p>
        <div className="mt-3 h-2 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(41,107,191), rgb(115,217,242), rgb(255,242,191))' }} aria-hidden />
        <div className="flex justify-between text-[10px] text-fog-2 mt-1">
          <span>0 m/s</span>
          <span>0.6</span>
          <span>1.2+ m/s</span>
        </div>
        <p className="text-xs text-fog-2 mt-3">NASA/JPL OSCAR via NOAA CoastWatch · frozen surface field · drag to rotate</p>
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
