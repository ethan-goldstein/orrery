import { Link } from 'wouter';
import { ROUTES } from '@/app/route-list';
import { useExperience } from '@/app/EngineContext';
import { SkyExperience } from '@/experiences/sky/SkyExperience';
import { prefetchRoute } from '@/app/prefetch';
import { Glyph, type GlyphName } from '@/ui/shell/icons';

const factory = () => new SkyExperience();

export default function HomePage() {
  useExperience('home', factory);
  return (
    <section className="plate home-plate" data-ui>
      <p className="kicker">An atlas of worlds</p>
      <h1 className="text-5xl md:text-6xl">Everything, in motion.</h1>
      <p className="dek">Eight worlds to explore: the Solar System at any date, Earth across 4.54 billion years, the Moon and Mars in orbital detail, thousands of satellites, every big earthquake since 2000, the ocean’s currents, and the human story.</p>
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
