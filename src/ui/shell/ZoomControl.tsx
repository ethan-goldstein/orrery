import { useCamera } from '@/store/camera';

/** Zoom in / out / reset plus a distance readout. Present on every page; disabled where the camera is fixed. */
export function ZoomControl() {
  const min = useCamera((s) => s.min);
  const max = useCamera((s) => s.max);
  const readout = useCamera((s) => s.readout);
  const zoomIn = useCamera((s) => s.zoomIn);
  const zoomOut = useCamera((s) => s.zoomOut);
  const reset = useCamera((s) => s.reset);
  const can = min < max;
  const btn = 'w-8 h-8 rounded-full bg-fog/10 hover:bg-fog/20 disabled:opacity-30 disabled:hover:bg-fog/10 text-base leading-none';
  return (
    <div className="flex items-center gap-1" data-testid="zoom-control" role="group" aria-label="Camera">
      <button className={btn} onClick={zoomIn} disabled={!can} aria-label="Zoom in" title="Zoom in (+)">
        +
      </button>
      <button className={btn} onClick={zoomOut} disabled={!can} aria-label="Zoom out" title="Zoom out (−)">
        −
      </button>
      <button className={btn} onClick={reset} disabled={!can} aria-label="Reset view" title="Reset view (0)">
        ⟲
      </button>
      {readout && (
        <output className="font-mono text-xs text-fog-2 tabular-nums ml-1 min-w-24" data-testid="camera-readout" aria-live="off">
          {readout}
        </output>
      )}
    </div>
  );
}
