/** Plain data so the Vite build plugin can import it without React. */
export interface RouteInfo {
  path: string;
  id: string;
  nav: string;
  title: string;
  description: string;
  phase: number;
}

export const ROUTES: RouteInfo[] = [
  { path: '/', id: 'home', nav: 'Home', title: 'Orrery', description: 'An atlas of worlds. Earth, the Moon and the Solar System rendered from real ephemerides.', phase: 0 },
  { path: '/solar', id: 'solar', nav: 'Solar System', title: 'Orrery — Solar System', description: 'Eight planets and their moons at any date, in illustrated or true scale.', phase: 1 },
  { path: '/earth', id: 'earth', nav: 'Earth', title: 'Orrery — Earth', description: 'Travel through 4.54 billion years of Earth history.', phase: 2 },
  { path: '/moon', id: 'moon', nav: 'Moon', title: 'Orrery — Moon', description: 'The Moon in LRO detail, with every landing site.', phase: 2 },
  { path: '/orbit', id: 'orbit', nav: 'Orbit', title: 'Orrery — Orbit', description: 'Thousands of tracked satellites around Earth, propagated live.', phase: 3 },
  { path: '/quakes', id: 'quakes', nav: 'Earthquakes', title: 'Orrery — Earthquakes', description: 'Every magnitude 6+ earthquake since 2000.', phase: 3 },
  { path: '/oceans', id: 'oceans', nav: 'Oceans', title: 'Orrery — Oceans', description: 'Surface currents flowing across one connected ocean.', phase: 4 },
  { path: '/civilization', id: 'civilization', nav: 'Civilization', title: 'Orrery — Civilization', description: 'Eighteen chapters of the human story on the globe.', phase: 4 },
];
