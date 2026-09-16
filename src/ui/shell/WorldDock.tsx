import { useEffect, useState } from 'react';
import { bodyInfo, PLANETS } from '@/astro/bodies';
import { solarStore, useSolar } from '@/store/solar';
import { assetUrl, loadManifest, type Manifest } from '@/engine/Assets';

/** Ten discs: the Sun, the planets and Pluto. One click goes there. */
export function WorldDock() {
  const focus = useSolar((s) => s.focus);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    loadManifest().then(setManifest).catch(() => undefined);
  }, []);
  const thumb = (textureId: string | null) => {
    const e = manifest?.textures.find((t) => t.id === textureId);
    const f = e?.files['1k']?.webp;
    return f ? `url(${assetUrl(f)})` : undefined;
  };
  const items = [bodyInfo('sun'), ...PLANETS, bodyInfo('pluto')];
  return (
    <nav aria-label="Bodies" className="world-dock" data-ui>
      <ul className="flex items-center gap-0.5" data-testid="planet-strip">
        {items.map((b) => (
          <li key={b.id}>
            <button
              className="world-dock-btn"
              aria-pressed={focus === b.id}
              aria-label={b.name}
              data-tip={b.name}
              onClick={() => solarStore.getState().setFocus(b.id, 'planet')}
              data-body={b.id}
            >
              <span className="picker-thumb" style={{ backgroundImage: thumb(b.texture), backgroundColor: b.color }} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
