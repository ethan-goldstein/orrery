import { Link } from 'wouter';
import { ROUTES } from '@/app/route-list';
import { useExperience } from '@/app/EngineContext';
import { SkyExperience } from '@/experiences/sky/SkyExperience';

const factory = () => new SkyExperience();

export default function HomePage() {
  useExperience('home', factory);
  return (
    <section className="p-6 md:p-10 max-w-xl" data-ui>
      <p className="kicker">An atlas of worlds</p>
      <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mt-3">Everything, in motion.</h1>
      <p className="mt-4 text-fog-2 leading-relaxed">
        Seven worlds to explore: the Solar System at any date, Earth across 4.54 billion years, the Moon in LRO detail, thousands of satellites, every big earthquake since 2000, the ocean’s currents, and the human story.
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-2 text-sm">
        {ROUTES.filter((r) => r.id !== 'home').map((r) => (
          <li key={r.id}>
            <Link href={r.path} className="block rounded-lg bg-ink-2/70 px-4 py-3 hover:bg-ink-2">
              <span className="block">{r.nav}</span>
              <span className="block text-xs text-fog-2 mt-1">{r.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
