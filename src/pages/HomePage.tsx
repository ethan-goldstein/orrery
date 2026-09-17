import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ROUTES } from '@/app/route-list';
import { useExperience } from '@/app/EngineContext';
import { SkyExperience } from '@/experiences/sky/SkyExperience';
import { prefetchRoute } from '@/app/prefetch';
import { Glyph, type GlyphName } from '@/ui/shell/icons';
import { almanacNow, type AlmanacEntry, type DataStatus } from '@/astro/almanac';
import { assetUrl } from '@/engine/Assets';

const factory = () => new SkyExperience();

export default function HomePage() {
  useExperience('home', factory);
  const [almanac, setAlmanac] = useState<AlmanacEntry[]>(() => safeAlmanac(Date.now()));
  useEffect(() => {
    let alive = true;
    fetch(assetUrl('data/status.json'))
      .then((r) => (r.ok ? (r.json() as Promise<DataStatus>) : Promise.reject(new Error(String(r.status)))))
      .then((status) => alive && setAlmanac(safeAlmanac(Date.now(), status)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="plate home-plate" data-ui>
      <p className="kicker">An atlas of worlds</p>
      <h1 className="text-5xl md:text-6xl">Everything, in motion.</h1>
      <p className="dek">Eight worlds to explore: the Solar System at any date, Earth across 4.54 billion years, the Moon and Mars in orbital detail, thousands of satellites, every big earthquake since 2000, the ocean’s currents, and the human story.</p>
      {almanac.length > 0 && (
        <>
          <p className="kicker home-kicker">Right now</p>
          <ul className="home-almanac" data-testid="almanac">
            {almanac.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="home-almanac-card card" data-almanac={a.id}>
                  <span className="home-almanac-kicker">{a.kicker}</span>
                  <span className="home-almanac-value">{a.value}</span>
                  <span className="home-almanac-note">{a.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="kicker home-kicker">The worlds</p>
      <ul className="home-grid">
        {ROUTES.filter((r) => r.id !== 'home').map((r, i) => {
          const Icon = Glyph[r.id as GlyphName] ?? Glyph.solar;
          return (
            <li key={r.id}>
              <Link href={r.path} className="home-card card" onPointerEnter={() => prefetchRoute(r.id)} onFocus={() => prefetchRoute(r.id)}>
                <span className="home-card-head">
                  <span className="kicker" style={{ borderTop: 0, padding: 0, minWidth: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Icon size={20} />
                </span>
                <span className="home-card-name">{r.nav}</span>
                <span className="home-card-desc">{r.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function safeAlmanac(nowMs: number, status?: DataStatus): AlmanacEntry[] {
  try {
    return almanacNow(nowMs, status);
  } catch {
    return [];
  }
}
