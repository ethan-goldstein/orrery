import { useEffect, useRef } from 'react';
import sources from '@/generated/sources.json';

export function SourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sources-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} data-ui aria-labelledby="sources-title">
      <div className="p-6 max-h-[80vh] overflow-y-auto">
        <p className="kicker">Data, imagery &amp; science</p>
        <h2 id="sources-title" className="text-2xl font-semibold mt-1">
          Where this comes from.
        </h2>
        <p className="mt-3 text-sm text-fog-2 leading-relaxed">
          Positions are computed live with astronomy-engine (VSOP87 and ELP-2000 series, arcminute accuracy from 1700 to 2200) and validated
          in the test suite against NASA/JPL Horizons. Smaller moons are seeded from one Horizons state and propagated as two-body orbits, so
          they drift from reality over years. Illustrated scale enlarges bodies and compresses distances; true scale does not lie.
        </p>
        <h3 className="kicker mt-5">Datasets</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {sources.data.map((d) => (
            <li key={d.id}>
              <strong>{d.title}</strong>
              <p className="text-fog-2 text-xs mt-0.5 whitespace-pre-line">{d.summary}</p>
            </li>
          ))}
        </ul>
        <h3 className="kicker mt-5">Imagery</h3>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {sources.textures.map((t) => (
            <li key={t.id} className="text-fog-2">
              <span className="text-fog">{t.id}</span> ·{' '}
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="underline">
                {t.title.replace(/ \(.*\)$/, '')}
              </a>{' '}
              · {t.license}
            </li>
          ))}
        </ul>
        <h3 className="kicker mt-5">Software</h3>
        <ul className="mt-2 text-xs text-fog-2 space-y-1">
          {sources.software.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline text-fog">
                {s.title}
              </a>{' '}
              · {s.license}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-fog-2">Intended for exploration and education, not navigation.</p>
        <button className="chip mt-5" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
