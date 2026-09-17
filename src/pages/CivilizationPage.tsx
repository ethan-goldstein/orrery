import { useEffect, useState } from 'react';
import { useExperience } from '@/app/EngineContext';
import { CivilizationExperience, type Chapter } from '@/experiences/civilization/CivilizationExperience';
import { civStore, useCiv } from '@/store/civ';
import { useExperience as useExperienceState } from '@/store/experience';
import { assetUrl } from '@/engine/Assets';
import { writeUrl } from '@/app/url-state';

const factory = () => new CivilizationExperience();

export default function CivilizationPage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ch = Number(p.get('ch'));
    if (p.get('ch') && Number.isFinite(ch)) civStore.setState({ chapter: Math.max(0, Math.min(17, ch - 1)) });
  }, []);
  useExperience('civilization', factory);
  const chapter = useCiv((s) => s.chapter);
  const playing = useCiv((s) => s.playing);
  const speed = useCiv((s) => s.speed);
  const night = useCiv((s) => s.night);
  const cleanView = useExperienceState((s) => s.cleanView);
  const set = civStore.getState().set;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  useEffect(() => {
    fetch(assetUrl('data/civ/chapters.json'))
      .then((r) => r.json())
      .then((d) => setChapters(d.chapters))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    writeUrl((p) => p.set('ch', String(chapter + 1)));
  }, [chapter]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey) return;
      if (e.shiftKey && e.key.startsWith('Arrow')) return; // Shift+arrows orbit the camera (global)
      const s = civStore.getState();
      if (e.key === 'ArrowRight') s.set({ chapter: Math.min(s.chapterCount - 1, s.chapter + 1), playing: false });
      if (e.key === 'ArrowLeft') s.set({ chapter: Math.max(0, s.chapter - 1), playing: false });
      if (e.key === ' ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        s.set({ playing: !s.playing });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (cleanView) return null;
  const c = chapters[chapter];
  return (
    <>
      <section className="plate" aria-live="polite">
        <p className="kicker">{c ? `${String(c.n).padStart(2, '0')} / ${chapters.length} · ${c.when}` : 'A journey through human history'}</p>
        <h1 key={c?.id ?? 'intro'} data-testid="chapter-title">
          {c ? c.title : 'The story of us.'}
        </h1>
        <p className="dek">{c ? c.story : 'We crossed oceans. We raised cities. We changed the world, and each other. Follow the traces we left behind.'}</p>
        {c && <p className="mt-2 text-xs text-fog-2">Source: {c.source}</p>}
        <div className="mt-5 flex flex-wrap gap-2" data-ui>
          <button className="chip" onClick={() => set({ chapter: Math.max(0, chapter - 1), playing: false })} aria-label="Previous chapter" disabled={chapter === 0}>
            ←
          </button>
          <button className="chip" onClick={() => set({ chapter: Math.min(chapters.length - 1, chapter + 1), playing: false })} aria-label="Next chapter" data-testid="next-chapter">
            Next →
          </button>
          <button className="chip" aria-pressed={playing} onClick={() => set(playing ? { playing: false } : { chapter: chapter >= chapters.length - 1 ? 0 : chapter, playing: true })} data-testid="play-journey">
            {playing ? 'Ⅱ Pause journey' : '▶ Play the journey'}
          </button>
          <button className="chip" onClick={() => set({ speed: [0.5, 1, 2][([0.5, 1, 2].indexOf(speed) + 1) % 3]! })} aria-label="Playback speed">
            {speed}×
          </button>
          <button className="chip" aria-pressed={night} onClick={() => set({ night: !night })}>
            {night ? 'After dark' : 'Natural'}
          </button>
        </div>
        <ol className="mt-4 flex flex-wrap gap-1" data-ui aria-label="All chapters">
          {chapters.map((ch, i) => (
            <li key={ch.id}>
              <button className={`w-7 h-7 rounded-full text-[11px] ${i === chapter ? 'bg-glow/20 text-glow' : i < chapter ? 'bg-fog/15 text-fog' : 'bg-fog/5 text-fog-2'}`} onClick={() => set({ chapter: i, playing: false })} aria-label={`${ch.n}. ${ch.title}, ${ch.when}`} aria-current={i === chapter ? 'step' : undefined} data-chapter={ch.n}>
                {ch.n}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <aside className="card drawer" data-ui>
        <p className="text-3xl font-semibold tabular-nums">300,000</p>
        <p className="kicker">years of becoming</p>
        <p className="text-xs text-fog-2 mt-3">Night lights appear only once electricity does: none before 1882, faint through the twentieth century, today’s full glow at the end. Chapter locations are published site coordinates.</p>
        <p className="text-xs text-fog-2 mt-2">← → chapters · Space plays · H hides the interface</p>
      </aside>
    </>
  );
}
