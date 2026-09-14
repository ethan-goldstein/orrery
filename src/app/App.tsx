import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { Route, Router, Switch } from 'wouter';
import { EngineProvider } from './EngineContext';
import { Header } from '@/ui/shell/Header';
import { TimeBar } from '@/ui/shell/TimeBar';
import { StatusLine } from '@/ui/shell/StatusLine';
import { ROUTES } from './route-list';
import { parseSharedState } from './url-state';
import { clockStore } from '@/store/clock';
import { settingsStore } from '@/store/settings';

const pages: Record<string, LazyExoticComponent<ComponentType>> = {
  home: lazy(() => import('@/pages/HomePage')),
  solar: lazy(() => import('@/pages/SolarPage')),
  earth: lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.make('earth') }))),
  moon: lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.make('moon') }))),
  orbit: lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.make('orbit') }))),
  quakes: lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.make('quakes') }))),
  oceans: lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.make('oceans') }))),
  civilization: lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.make('civilization') }))),
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function App() {
  useEffect(() => {
    const s = parseSharedState(window.location.search);
    const clock = clockStore.getState();
    if (s.t === 'now') clock.setFollowNow(true);
    else if (s.t) clock.setEpoch(Date.parse(s.t));
    if (s.rate !== undefined) clock.setRate(s.rate);
    if (s.q) settingsStore.getState().setQuality(s.q);
    if (s.labels !== undefined) settingsStore.getState().setLabels(s.labels);
  }, []);

  return (
    <Router base={base}>
      <EngineProvider>
        <div className="chrome">
          <Header />
          <Suspense fallback={<div className="p-6 kicker">Loading…</div>}>
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
          </Suspense>
          <div className="flex flex-col gap-2 p-4">
            <StatusLine />
            <TimeBar />
          </div>
        </div>
      </EngineProvider>
    </Router>
  );
}

function NotFound() {
  return (
    <section className="p-6" data-ui>
      <p className="kicker">404</p>
      <h1 className="text-2xl font-semibold mt-2">Nothing out here.</h1>
    </section>
  );
}
