import { useEffect, useRef, useState } from 'react';

const ROWS: [string, string][] = [
  ['Space', 'Play or pause time (or the story on Earth and Civilization)'],
  ['N', 'Jump to now'],
  ['[ / ]', 'Slower / faster'],
  ['H', 'Hide or show the interface'],
  ['F', 'Fullscreen'],
  ['⌘K / Ctrl+K', 'Command palette: any world, satellite, era, chapter or setting'],
  ['?', 'This list'],
  ['+ / − / 0', 'Zoom in, zoom out, reset the view'],
  ['I', 'Show or hide the facts drawer'],
  ['Shift + arrows', 'Orbit the camera'],
  ['Scroll or pinch', 'Zoom toward the cursor'],
  ['Double-click', 'Zoom in on that spot (or fly to that world)'],
  ['Solar: 1–9, ← →', 'Pick planets, step planets'],
  ['Solar: S / P / T / M / Esc', 'True scale, paths, tour, moons view, back to the Sun'],
  ['Earth: ← → Home End C', 'Eras, formation, today, compare'],
  ['Earth: Shift + scroll', 'Travel through time'],
  ['Civilization: ← →', 'Previous / next chapter'],
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === '?') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sources-dialog" onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)} data-ui aria-labelledby="shortcuts-title">
      <div className="p-6">
        <p className="kicker">Keyboard</p>
        <h2 id="shortcuts-title" className="text-2xl font-semibold mt-1">
          Shortcuts
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {ROWS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd className="text-fog-2">{v}</dd>
            </div>
          ))}
        </dl>
        <button className="chip mt-5" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </dialog>
  );
}
