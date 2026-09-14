import { Link, useLocation } from 'wouter';
import { ROUTES } from '@/app/route-list';
import { useExperience } from '@/store/experience';
import { useState } from 'react';
import { SourcesDialog } from '@/ui/SourcesDialog';
import { SettingsButton } from '@/ui/Settings';

export function Header() {
  const [location] = useLocation();
  const cleanView = useExperience((s) => s.cleanView);
  const [sources, setSources] = useState(false);
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
      <div className="flex items-center gap-4 text-xs">
        <button className="text-fog-2 hover:text-fog" onClick={() => setSources(true)} data-testid="sources-button">
          Sources ↗
        </button>
        <SettingsButton />
        <a href="https://github.com/ethan-goldstein/orrery" target="_blank" rel="noopener noreferrer" className="text-fog-2 hover:text-fog">
          GitHub ↗
        </a>
      </div>
      <SourcesDialog open={sources} onClose={() => setSources(false)} />
    </header>
  );
}
