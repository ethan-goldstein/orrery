import { useEffect, useRef, useState } from 'react';
import { useEngine } from '@/app/EngineContext';
import { useExperience } from '@/store/experience';
import { Glyph } from './icons';
import { captureFrame, copyLinkToClipboard, downloadFile } from './share';

type Status = { text: string; ok: boolean } | null;

/**
 * Share what you are looking at: copy the address (it carries the date, the
 * world and the view), save a captioned image of the frame, or hand both to
 * the system share sheet on phones.
 */
export function ShareMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const engine = useEngine();
  const active = useExperience((s) => s.active);
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3200);
    return () => clearTimeout(t);
  }, [status]);

  const copyLink = async () => {
    const ok = await copyLinkToClipboard();
    setStatus(ok ? { text: 'Link copied', ok: true } : { text: 'Copy failed. The address bar has the link.', ok: false });
  };

  const capture = () => captureFrame(engine, active);

  const saveImage = async () => {
    setBusy(true);
    try {
      const file = await capture();
      if (!file) throw new Error('no frame');
      downloadFile(file);
      setStatus({ text: `Saved ${file.name}`, ok: true });
    } catch {
      setStatus({ text: 'Could not capture the frame', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const shareSheet = async () => {
    setBusy(true);
    try {
      const file = await capture();
      const data: ShareData = { title: document.title, url: window.location.href };
      if (file && navigator.canShare({ files: [file] })) data.files = [file];
      await navigator.share(data);
      setStatus({ text: 'Shared', ok: true });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setStatus({ text: 'Sharing is not available here', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button className={`rail-link${open ? ' is-active' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-label="Share this view" data-tip="Share" data-testid="share-button">
        <Glyph.share />
      </button>
      {open && (
        <div className="card settings-pop share-pop p-3 text-sm" role="dialog" aria-label="Share" data-ui>
          <p className="kicker" style={{ borderTop: 0, padding: 0, minWidth: 0 }}>
            Share this view
          </p>
          <div className="share-actions">
            <button className="seg-btn" onClick={copyLink} disabled={busy} data-testid="copy-link">
              Copy link
            </button>
            <button className="seg-btn" onClick={saveImage} disabled={busy || active === null} data-testid="save-image">
              {busy ? 'Rendering…' : 'Save image'}
            </button>
            {canShareFiles && (
              <button className="seg-btn" onClick={shareSheet} disabled={busy} data-testid="share-sheet">
                Share…
              </button>
            )}
          </div>
          <p className="share-hint">The link carries the date, the world and the view. The image is the frame you see with a caption plate.</p>
          <p role="status" aria-live="polite" className={`share-status${status ? (status.ok ? ' is-ok' : ' is-err') : ''}`} data-testid="share-status">
            {status?.text ?? ''}
          </p>
        </div>
      )}
    </div>
  );
}
