import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { Route, Router, Switch } from 'wouter';
import { EngineProvider } from './EngineContext';
import { Rail } from '@/ui/shell/Rail';
import { InstrumentBar } from '@/ui/shell/InstrumentBar';
import { StatusLine } from '@/ui/shell/StatusLine';
import { ROUTES } from './route-list';
import { parseSharedState } from './url-state';
import { clockStore } from '@/store/clock';
import { settingsStore } from '@/store/settings';
import { useShell } from '@/store/shell';
import { CommandPalette } from '@/ui/CommandPalette';
import { ShortcutsOverlay } from '@/ui/ShortcutsOverlay';
import { MobileSheet } from '@/ui/shell/MobileSheet';
import { installGlobalShortcuts } from './shortcuts';
import { useExperience as useExperienceState } from '@/store/experience';

const pages: Record<string, LazyExoticComponent<ComponentType>> = {
  home: lazy(() => import('@/pages/HomePage')),
  solar: lazy(() => import('@/pages/SolarPage')),
  earth: lazy(() => import('@/pages/EarthPage')),
  moon: lazy(() => import('@/pages/MoonPage')),
  mars: lazy(() => import('@/pages/MarsPage')),
  orbit: lazy(() => import('@/pages/OrbitPage')),
  quakes: lazy(() => import('@/pages/QuakesPage')),
  oceans: lazy(() => import('@/pages/OceansPage')),
  civilization: lazy(() => import('@/pages/CivilizationPage')),
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function App() {
  const drawer = useShell((s) => s.drawerOpen);
  useEffect(() => {
    const s = parseSharedState(window.location.search);
    const clock = clockStore.getState();
    if (s.t === 'now') clock.setFollowNow(true);
    else if (s.t) clock.setEpoch(Date.parse(s.t));
    if (s.rate !== undefined) clock.setRate(s.rate);
    if (s.q) settingsStore.getState().setQuality(s.q);
    if (s.labels !== undefined) settingsStore.getState().setLabels(s.labels);
    return installGlobalShortcuts();
  }, []);

  return (
    <Router base={base}>
      <EngineProvider>
        <div className="chrome" data-drawer={drawer ? 'true' : 'false'}>
          <Rail />
          <Suspense fallback={<div className="page p-6 kicker">Loading…</div>}>
            <MobileSheet>
              <Switch>
                {ROUTES.map((r) => {
                  const Page = pages[r.id]!;
                  return (
                    <Route key={r.id} path={r.path}>
                      <Page />
                    </Route>
                  );
                })}
                <Route>
                  <NotFound />
                </Route>
              </Switch>
            </MobileSheet>
          </Suspense>
          <div className="chrome-foot">
            <StatusLine />
            <InstrumentBar />
          </div>
        </div>
        <CommandPalette />
        <ShortcutsOverlay />
        <JourneyVeil />
      </EngineProvider>
    </Router>
  );
}

/** Fades the stage to black between worlds so a swap never flashes a half-built scene. */
function JourneyVeil() {
  const journey = useExperienceState((s) => s.journey);
  return <div className="journey-veil" data-active={journey === 'veil' ? 'true' : 'false'} data-journey={journey || 'none'} aria-hidden="true" />;
}

function NotFound() {
  return (
    <section className="plate" data-ui>
      <p className="kicker">404</p>
      <h1>Nothing out here.</h1>
    </section>
  );
}
