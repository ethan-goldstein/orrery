import { useEffect, useState } from 'react';
import { useExperience } from '@/store/experience';
import { useNarrow } from './useNarrow';

const KEY = 'orrery:hint';

const seen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'seen';
  } catch {
    return false;
  }
};

const markSeen = (): void => {
  try {
    localStorage.setItem(KEY, 'seen');
  } catch {
    /* private mode */
  }
};

/**
 * A one-time line above the instrument bar telling a first-time visitor how
 * the stage answers to them. Goes away on the first drag, wheel or tap, on
 * the close button, or after ten seconds, and never comes back on this device.
 */
export function ControlsHint() {
  const active = useExperience((s) => s.active);
  const cleanView = useExperience((s) => s.cleanView);
  const narrow = useNarrow();
  const [show, setShow] = useState(() => !seen());

  useEffect(() => {
    if (!show || !active || active === 'home') return;
    const dismiss = () => {
      markSeen();
      setShow(false);
    };
    const stage = document.querySelector('[role="application"]');
    const opts = { passive: true, once: true } as const;
    stage?.addEventListener('pointerdown', dismiss, opts);
    stage?.addEventListener('wheel', dismiss, opts);
    const t = setTimeout(dismiss, 10_000);
    return () => {
      stage?.removeEventListener('pointerdown', dismiss);
      stage?.removeEventListener('wheel', dismiss);
      clearTimeout(t);
    };
  }, [show, active]);

  if (!show || cleanView || !active || active === 'home') return null;
  const text = narrow ? 'Drag to orbit · pinch to zoom · double-tap to close in' : 'Drag to orbit · scroll or pinch to zoom · double-click to close in · press ? for keys';
  return (
    <div className="controls-hint card" role="note" data-ui data-testid="controls-hint">
      <span>{text}</span>
      <button
        className="controls-hint-close"
        aria-label="Dismiss hint"
        onClick={() => {
          markSeen();
          setShow(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
