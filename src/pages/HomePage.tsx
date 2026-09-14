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
        Earth, the Moon, eight planets and their moons, drawn from real ephemerides at any date you choose.
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-2 text-sm">
        {ROUTES.filter((r) => r.id !== 'home').map((r) => (
          <li key={r.id}>
            <Link href={r.path} className="block rounded-lg bg-ink-2/70 px-4 py-3 hover:bg-ink-2">
              <span className="block">{r.nav}</span>
              <span className="block text-xs text-fog-2 mt-1">{r.phase > 0 ? `Phase ${r.phase}` : ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
