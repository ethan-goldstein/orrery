/**
 * Pulls state vectors from NASA/JPL Horizons (public API, no key) and writes:
 *   public/data/solar/moons.json            one planet-centred state per moon at EPOCH,
 *                                           used to seed the Keplerian propagator
 *   tests/unit/astro/fixtures/horizons.json heliocentric planet + Moon vectors at FIXTURE
 *                                           dates, used to validate astronomy-engine
 * All vectors: ecliptic J2000, km and km/s, geometric (no light-time correction).
 *
 *   npx tsx scripts/fetch-horizons.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const EPOCH = '2026-01-01';
const FIXTURES = ['2000-01-01 12:00', '2026-09-14 12:00', '2100-06-01', '1800-03-15'];

const MOONS: { id: string; horizons: number; parent: string; center: string }[] = [
  { id: 'phobos', horizons: 401, parent: 'mars', center: '500@499' },
  { id: 'deimos', horizons: 402, parent: 'mars', center: '500@499' },
  { id: 'io', horizons: 501, parent: 'jupiter', center: '500@599' },
  { id: 'europa', horizons: 502, parent: 'jupiter', center: '500@599' },
  { id: 'ganymede', horizons: 503, parent: 'jupiter', center: '500@599' },
  { id: 'callisto', horizons: 504, parent: 'jupiter', center: '500@599' },
  { id: 'mimas', horizons: 601, parent: 'saturn', center: '500@699' },
  { id: 'enceladus', horizons: 602, parent: 'saturn', center: '500@699' },
  { id: 'tethys', horizons: 603, parent: 'saturn', center: '500@699' },
  { id: 'dione', horizons: 604, parent: 'saturn', center: '500@699' },
  { id: 'rhea', horizons: 605, parent: 'saturn', center: '500@699' },
  { id: 'titan', horizons: 606, parent: 'saturn', center: '500@699' },
  { id: 'iapetus', horizons: 608, parent: 'saturn', center: '500@699' },
  { id: 'miranda', horizons: 705, parent: 'uranus', center: '500@799' },
  { id: 'ariel', horizons: 701, parent: 'uranus', center: '500@799' },
  { id: 'umbriel', horizons: 702, parent: 'uranus', center: '500@799' },
  { id: 'titania', horizons: 703, parent: 'uranus', center: '500@799' },
  { id: 'oberon', horizons: 704, parent: 'uranus', center: '500@799' },
  { id: 'proteus', horizons: 808, parent: 'neptune', center: '500@899' },
  { id: 'triton', horizons: 801, parent: 'neptune', center: '500@899' },
  { id: 'charon', horizons: 901, parent: 'pluto', center: '500@999' },
];

/** GM of the central body, km^3/s^2 (JPL DE440 / satellite ephemeris values). */
const GM: Record<string, number> = {
  mars: 42828.375214,
  jupiter: 126686531.9,
  saturn: 37931206.2,
  uranus: 5793951.3,
  neptune: 6835100.0,
  pluto: 975.5, // Pluto + Charon system mass; Charon's orbit is around the barycentre
};

const PLANETS: { id: string; horizons: number }[] = [
  { id: 'mercury', horizons: 199 },
  { id: 'venus', horizons: 299 },
  { id: 'earth', horizons: 399 },
  { id: 'mars', horizons: 499 },
  { id: 'jupiter', horizons: 599 },
  { id: 'saturn', horizons: 699 },
  { id: 'uranus', horizons: 799 },
  { id: 'neptune', horizons: 899 },
  { id: 'pluto', horizons: 999 },
];

type State = [number, number, number, number, number, number];

async function vectors(command: number, center: string, start: string, stopDays = 1): Promise<{ jd: number; state: State }[]> {
  const stop = new Date(Date.parse(start.replace(' ', 'T') + (start.includes(':') ? ':00Z' : 'T00:00:00Z')) + stopDays * 86_400_000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${center}'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: "'1 d'",
    REF_PLANE: "'ECLIPTIC'",
    VEC_TABLE: "'2'",
    VEC_CORR: "'NONE'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
  });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    const text = await res.text();
    const block = text.split('$$SOE')[1]?.split('$$EOE')[0];
    if (res.ok && block) {
      return block
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const f = line.split(',').map((s) => s.trim());
          return { jd: Number(f[0]), state: f.slice(2, 8).map(Number) as State };
        });
    }
    console.warn(`retry ${command}@${center} (${res.status})`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`Horizons failed for ${command}@${center}`);
}

const retrieved = new Date().toISOString();

// Moons: one state at EPOCH
const moons: Record<string, { parent: string; gm: number; epochMs: number; state: State }> = {};
for (const m of MOONS) {
  const rows = await vectors(m.horizons, m.center, EPOCH);
  moons[m.id] = { parent: m.parent, gm: GM[m.parent]!, epochMs: Date.parse(`${EPOCH}T00:00:00Z`), state: rows[0]!.state };
  console.log(`${m.id.padEnd(10)} |r| = ${Math.hypot(...rows[0]!.state.slice(0, 3)).toFixed(0)} km`);
}
mkdirSync('public/data/solar', { recursive: true });
const moonsOut = {
  source: 'NASA/JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api',
  frame: 'ecliptic J2000, planet-centred, km and km/s, geometric',
  epoch: EPOCH,
  retrieved,
  note: 'One osculating state per moon. Propagated as two-body Kepler orbits; nodal and apsidal precession are not modelled.',
  moons,
};
writeFileSync('public/data/solar/moons.json', JSON.stringify(moonsOut));
writeFileSync(
  'public/data/solar/README.md',
  `# Solar system data

## moons.json
Planet-centred state vectors (ecliptic J2000, km, km/s, geometric) for ${MOONS.length} moons at ${EPOCH} 00:00 UTC,
retrieved ${retrieved} from NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/). Public domain (US Government work).
The app converts each to osculating Keplerian elements and propagates them as two-body orbits; nodal and apsidal
precession are not modelled, so positions drift from the true ephemeris over years. The Galilean moons and Earth's
Moon are computed by astronomy-engine instead.

Central-body GM values (km^3/s^2): ${Object.entries(GM).map(([k, v]) => `${k} ${v}`).join(', ')}.
`,
);

// Fixtures: heliocentric planets + geocentric Moon at several dates
const fixtures: Record<string, Record<string, State>> = {};
for (const when of FIXTURES) {
  fixtures[when] = {};
  for (const p of PLANETS) {
    const rows = await vectors(p.horizons, '500@10', when);
    fixtures[when][p.id] = rows[0]!.state;
  }
  const moonRows = await vectors(301, '500@399', when);
  fixtures[when]['moon'] = moonRows[0]!.state;
  console.log(`fixtures ${when} done`);
}
mkdirSync('tests/unit/astro/fixtures', { recursive: true });
const fixtureOut = { source: moonsOut.source, frame: 'ecliptic J2000, Sun-centred (Moon: Earth-centred), km, km/s', retrieved, fixtures };
writeFileSync('tests/unit/astro/fixtures/horizons.json', JSON.stringify(fixtureOut, null, 1));
console.log('sha256', createHash('sha256').update(JSON.stringify(fixtureOut)).digest('hex').slice(0, 16));
