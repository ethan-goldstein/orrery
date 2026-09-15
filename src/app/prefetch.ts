import { loadTexture } from '@/engine/Assets';
import { settingsStore } from '@/store/settings';
import { TIERS } from '@/engine/QualityTier';

/**
 * Warm a destination before the user clicks: its page chunk and the textures
 * it will ask for first. Called on pointerenter/focus of navigation links, so
 * a journey lands on a ready world instead of a black veil.
 */
const chunks: Record<string, () => Promise<unknown>> = {
  home: () => import('@/pages/HomePage'),
  solar: () => import('@/pages/SolarPage'),
  earth: () => import('@/pages/EarthPage'),
  moon: () => import('@/pages/MoonPage'),
  mars: () => import('@/pages/MarsPage'),
  orbit: () => import('@/pages/OrbitPage'),
  quakes: () => import('@/pages/QuakesPage'),
  oceans: () => import('@/pages/OceansPage'),
  civilization: () => import('@/pages/CivilizationPage'),
};

const warm: Record<string, string[]> = {
  solar: ['milky-way', 'sun'],
  earth: ['earth-day', 'earth-clouds', 'earth-night'],
  moon: ['moon-lroc', 'moon-normal'],
  mars: ['mars'],
  orbit: ['earth-day', 'earth-night'],
  quakes: ['earth-day'],
  oceans: ['earth-day'],
  civilization: ['earth-day', 'earth-night'],
};

const done = new Set<string>();

export function prefetchRoute(id: string): void {
  if (done.has(id)) return;
  done.add(id);
  void chunks[id]?.().catch(() => done.delete(id));
  const s = settingsStore.getState();
  const tier = TIERS[s.quality === 'auto' ? s.probedQuality : s.quality].textureTier;
  for (const tex of warm[id] ?? []) void loadTexture(tex, tier).catch(() => undefined);
}
