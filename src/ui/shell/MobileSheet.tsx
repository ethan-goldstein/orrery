import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useExperience } from '@/store/experience';

/**
 * On narrow screens the page copy and controls live in a bottom sheet that
 * peeks by default, opens on demand, and gets out of the way of the globe.
 */
export function MobileSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches);
  const cleanView = useExperience((s) => s.cleanView);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  // mirror the page's h1 into the handle so phones see the headline without opening the sheet
  useEffect(() => {
    if (!narrow || !bodyRef.current) return;
    const el = bodyRef.current;
    const read = () => setTitle(el.querySelector('h1')?.textContent?.trim() ?? '');
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [narrow]);
  useEffect(() => {
    const mq = matchMedia('(max-width: 767px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!narrow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [narrow]);
  if (!narrow) return <>{children}</>;
  if (cleanView) return null;
  return (
    <div className="mobile-sheet" data-open={open ? 'true' : 'false'} data-ui data-testid="mobile-sheet">
      <button className="mobile-sheet-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-sheet-body">
        {!open && title && <span className="mobile-sheet-title">{title}</span>}
        <span className="mobile-sheet-hint">{open ? 'Back to the view ↓' : 'View controls ↑'}</span>
      </button>
      <div id="mobile-sheet-body" className="mobile-sheet-body" inert={!open} ref={bodyRef}>
        {children}
      </div>
    </div>
  );
}
