import { Link, useLocation } from 'wouter';
import { ROUTES } from '@/app/route-list';
import { useExperience } from '@/store/experience';

export function Header() {
  const [location] = useLocation();
  const cleanView = useExperience((s) => s.cleanView);
  if (cleanView) return <div />;
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4" data-ui>
      <Link href="/" className="wordmark" aria-label="Orrery home">
        orrery
      </Link>
      <nav aria-label="Worlds" className="hidden md:flex gap-5 text-sm">
        {ROUTES.filter((r) => r.id !== 'home').map((r) => (
          <Link
            key={r.id}
            href={r.path}
            className={location === r.path ? 'text-fog' : 'text-fog-2 hover:text-fog'}
            aria-current={location === r.path ? 'page' : undefined}
          >
            {r.nav}
          </Link>
        ))}
      </nav>
      <a
        href="https://github.com/ethan-goldstein/orrery"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-fog-2 hover:text-fog"
      >
        Source ↗
      </a>
    </header>
  );
}
