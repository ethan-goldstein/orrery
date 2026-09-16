import { useEffect, useRef, useState } from 'react';
import { settingsStore, useSettings } from '@/store/settings';
import type { TierName } from '@/engine/QualityTier';
import { Glyph } from './shell/icons';

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const quality = useSettings((s) => s.quality);
  const probed = useSettings((s) => s.probedQuality);
  const labels = useSettings((s) => s.labels);
  const grain = useSettings((s) => s.grain);
  const units = useSettings((s) => s.units);
  const s = settingsStore.getState();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button className={`rail-link${open ? ' is-active' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" data-testid="settings-button" aria-label="Settings" data-tip="Settings">
        <Glyph.settings />
      </button>
      {open && (
        <div className="card settings-pop w-64 p-4 text-sm" role="dialog" aria-label="Settings">
          <label className="block">
            <span className="kicker">Quality</span>
            <select className="chip w-full mt-1 bg-ink-2" value={quality} onChange={(e) => s.setQuality(e.target.value as TierName | 'auto')} aria-label="Render quality">
              <option value="auto">Auto ({probed})</option>
              {(['low', 'med', 'high', 'ultra'] as const).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between mt-3">
            <span>Labels</span>
            <input type="checkbox" checked={labels} onChange={(e) => s.setLabels(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span>Film grain</span>
            <input type="checkbox" checked={grain} onChange={(e) => s.setGrain(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span>Units</span>
            <select className="chip bg-ink-2" value={units} onChange={(e) => s.setUnits(e.target.value as 'metric' | 'imperial')} aria-label="Units">
              <option value="metric">km</option>
              <option value="imperial">miles</option>
            </select>
          </label>
          <p className="text-xs text-fog-2 mt-3">Lower quality drops texture size, particle counts and bloom. Settings persist on this device.</p>
        </div>
      )}
    </div>
  );
}
