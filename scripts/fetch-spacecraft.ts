/**
 * Heliocentric trajectories for deep-space probes, a comet and two near-Earth
 * asteroids from JPL Horizons, sampled coarsely and interpolated at runtime.
 *   npx tsx scripts/fetch-spacecraft.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { horizonsVectors, type State } from './lib/horizons';

interface Target { id: string; command: string; start: string; stops: string[]; step: string; kind: 'probe' | 'comet' | 'asteroid' }
const TARGETS: Target[] = [
  { id: 'voyager1', command: '-31', start: '1977-09-06', stops: ['2030-01-01', '2027-01-01'], step: '30 d', kind: 'probe' },
  { id: 'voyager2', command: '-32', start: '1977-08-21', stops: ['2030-01-01', '2027-01-01'], step: '30 d', kind: 'probe' },
  { id: 'newhorizons', command: '-98', start: '2006-01-20', stops: ['2030-01-01', '2027-01-01'], step: '30 d', kind: 'probe' },
  { id: 'parker', command: '-96', start: '2018-08-13', stops: ['2026-12-31', '2026-06-01', '2025-12-01'], step: '2 d', kind: 'probe' },
  { id: 'halley', command: 'DES=1P; CAP;', start: '1900-01-01', stops: ['2100-01-01'], step: '30 d', kind: 'comet' },
  { id: 'apophis', command: '99942;', start: '2000-01-01', stops: ['2100-01-01'], step: '30 d', kind: 'asteroid' },
  { id: 'bennu', command: '101955;', start: '2000-01-01', stops: ['2100-01-01'], step: '30 d', kind: 'asteroid' },
];

const retrieved = new Date().toISOString();
const craft: Record<string, { kind: string; start: string; end: string; step: string; rows: number[][] }> = {};
for (const t of TARGETS) {
  let rows: { jd: number; state: State }[] | null = null;
  let used = '';
  for (const stop of t.stops) {
    try {
      rows = await horizonsVectors(t.command, '500@10', t.start, stop, t.step);
      used = stop;
      break;
    } catch (e) {
      console.warn(`  ${t.id}: ${(e as Error).message.slice(0, 140)}`);
    }
  }
  if (!rows || rows.length < 20) throw new Error(`${t.id}: no usable rows`);
  craft[t.id] = {
    kind: t.kind,
    start: t.start,
    end: used,
    step: t.step,
    rows: rows.map(({ jd, state }) => [+jd.toFixed(4), ...state.slice(0, 3).map((v) => Math.round(v)), ...state.slice(3).map((v) => +v.toFixed(4))]),
  };
  const last = rows[rows.length - 1]!.state;
  console.log(`${t.id.padEnd(12)} ${rows.length} rows, ${t.start}..${used}, last |r| = ${(Math.hypot(last[0], last[1], last[2]) / 149597870.7).toFixed(2)} AU`);
}
mkdirSync('public/data/solar', { recursive: true });
const out = { source: 'NASA/JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api', frame: 'ecliptic J2000, Sun-centred, km and km/s, geometric; rows = [jd, x, y, z, vx, vy, vz]', retrieved, craft };
const json = JSON.stringify(out);
writeFileSync('public/data/solar/spacecraft.json', json);
const readme = `
## spacecraft.json
Heliocentric state vectors (ecliptic J2000, km, km/s, geometric) from NASA/JPL Horizons, retrieved ${retrieved}, for
${Object.entries(craft).map(([k, v]) => `${k} (${v.kind}, ${v.start} to ${v.end}, every ${v.step}, ${v.rows.length} rows)`).join('; ')}.
Public domain (US Government work). Interpolated at runtime with cubic Hermite splines; positions between samples
are accurate to well under the drawn marker size. JWST is not fetched: it is drawn at Sun-Earth L2, 0.01 AU
anti-sunward of Earth.
`;
const { readFileSync } = await import('node:fs');
const readmePath = 'public/data/solar/README.md';
const current = readFileSync(readmePath, 'utf8');
writeFileSync(readmePath, current.includes('## spacecraft.json') ? current.replace(/\n## spacecraft\.json[\s\S]*$/, readme) : current + readme);
console.log(`wrote ${(json.length / 1e6).toFixed(2)} MB`);
