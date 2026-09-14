/**
 * Every magnitude 6+ earthquake since 2000 from the USGS FDSN event service.
 *   npx tsx scripts/fetch-usgs.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const START = '2000-01-01';
const END = new Date().toISOString().slice(0, 10);
const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${START}&endtime=${END}&minmagnitude=6&orderby=time-asc&limit=20000`;
const res = await fetch(url);
if (!res.ok) throw new Error(`USGS ${res.status}`);
const gj = (await res.json()) as { features: { id: string; properties: { time: number; mag: number; place: string; title: string; tsunami: number }; geometry: { coordinates: [number, number, number] } }[] };
const rows = gj.features.map((f) => [
  Math.round(f.properties.time / 1000),
  +f.geometry.coordinates[1].toFixed(3),
  +f.geometry.coordinates[0].toFixed(3),
  +f.geometry.coordinates[2].toFixed(1),
  +f.properties.mag.toFixed(1),
  f.properties.place ?? '',
  f.id,
]);
const out = { source: 'USGS Earthquake Hazards Program, FDSN event web service', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', retrieved: new Date().toISOString(), start: START, end: END, minMagnitude: 6, columns: ['unixSeconds', 'lat', 'lon', 'depthKm', 'mag', 'place', 'id'], count: rows.length, rows };
mkdirSync('public/data/quakes', { recursive: true });
const json = JSON.stringify(out);
writeFileSync('public/data/quakes/m6.json', json);
const biggest = [...gj.features].sort((a, b) => b.properties.mag - a.properties.mag).slice(0, 3).map((f) => `${f.properties.mag} ${f.properties.place}`);
writeFileSync(
  'public/data/quakes/README.md',
  `# Earthquakes, magnitude 6 and above

${rows.length} events from ${START} to ${END} from the USGS Earthquake Hazards Program FDSN event service
(https://earthquake.usgs.gov/fdsnws/event/1/), retrieved ${out.retrieved}, sha256 ${createHash('sha256').update(json).digest('hex').slice(0, 16)}.
USGS data are in the public domain. Largest: ${biggest.join('; ')}.
Columns: ${out.columns.join(', ')}. Cumulative records, not a hazard forecast.
`,
);
console.log(`wrote ${rows.length} quakes, ${(json.length / 1e6).toFixed(2)} MB; largest ${biggest[0]}`);
