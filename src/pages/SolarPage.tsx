import { useExperience } from '@/app/EngineContext';
import { SolarExperience } from '@/experiences/solar/SolarExperience';

const factory = () => new SolarExperience();

export default function SolarPage() {
  useExperience('solar', factory);
  return (
    <section className="p-6 md:p-10 max-w-md" data-ui>
      <p className="kicker">Beyond our world</p>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mt-3">Solar System</h1>
      <p className="mt-3 text-fog-2">Phase 0 scaffold: starfield, lit sphere, bloom. Real planets arrive in Phase 1.</p>
    </section>
  );
}
