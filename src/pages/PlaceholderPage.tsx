import { useExperience } from '@/app/EngineContext';
import { ROUTES } from '@/app/route-list';
import { SkyExperience } from '@/experiences/sky/SkyExperience';

const factory = () => new SkyExperience();

export function make(id: string) {
  const route = ROUTES.find((r) => r.id === id)!;
  return function PlaceholderPage() {
    useExperience(id, factory);
    return (
      <section className="p-6 md:p-10 max-w-md" data-ui>
        <p className="kicker">Phase {route.phase}</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-3">{route.nav}</h1>
        <p className="mt-3 text-fog-2">{route.description}</p>
        <p className="mt-2 text-sm text-fog-2">Under construction.</p>
      </section>
    );
  };
}
