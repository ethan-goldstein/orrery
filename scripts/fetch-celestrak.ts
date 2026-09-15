/**
 * Snapshot of tracked objects from CelesTrak (GP data in OMM JSON) joined with
 * the SATCAT for object type and launch date. Written as one JSON the Orbit
 * page feeds to satellite.js in a worker.
 *
 *   npx tsx scripts/fetch-celestrak.ts
 *
 * CelesTrak asks for no more than one request per group per couple of hours;
 * this script runs a handful of requests once and commits the result.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assertPlausible, unchanged } from './lib/guards';
import { writeStatus } from './lib/status';

const GROUPS = ['active', 'stations', 'analyst', 'cosmos-1408-debris', 'fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris'];
const OUT = 'public/data/orbit';

interface Omm {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

async function get(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'orrery-data-refresh (https://github.com/ethan-goldstein/orrery)' } });
    if (res.ok) return res.text();
    console.warn(`retry ${url}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error(`failed ${url}`);
}

process.on('unhandledRejection', (e) => {
  console.error(e);
  process.exit(1);
});

const objects = new Map<number, Omm>();
for (const g of GROUPS) {
  const text = await get(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`);
  let rows: Omm[];
  try {
    rows = JSON.parse(text) as Omm[];
  } catch {
    // a non-JSON answer is a rate limit or an outage: fail rather than commit a shrunken catalogue
    throw new Error(`group ${g}: not JSON (${text.slice(0, 80)})`);
  }
  let added = 0;
  for (const r of rows) {
    if (objects.has(r.NORAD_CAT_ID)) continue;
    objects.set(r.NORAD_CAT_ID, r);
    added++;
  }
  console.log(`${g.padEnd(22)} ${rows.length.toString().padStart(6)} rows, ${added} new`);
}

// SATCAT: object type + launch date
const satcat = await get('https://celestrak.org/pub/satcat.csv');
const lines = satcat.split('\n');
const header = lines[0]!.split(',');
const col = (n: string) => header.indexOf(n);
const iId = col('NORAD_CAT_ID');
const iType = col('OBJECT_TYPE');
const iLaunch = col('LAUNCH_DATE');
const iCountry = col('OWNER');
const meta = new Map<number, { type: string; launch: string; owner: string }>();
for (let i = 1; i < lines.length; i++) {
  const f = lines[i]!.split(',');
  const id = Number(f[iId]);
  if (!id) continue;
  meta.set(id, { type: f[iType] ?? '', launch: f[iLaunch] ?? '', owner: f[iCountry] ?? '' });
}

const TYPE_CODE: Record<string, number> = { PAY: 0, 'R/B': 1, DEB: 2, UNK: 3 };
const out = [...objects.values()]
  .map((o) => {
    const m = meta.get(o.NORAD_CAT_ID);
    return {
      n: o.OBJECT_NAME,
      id: o.NORAD_CAT_ID,
      t: TYPE_CODE[m?.type ?? 'UNK'] ?? 3,
      y: m?.launch ? Number(m.launch.slice(0, 4)) : 0,
      o: m?.owner ?? '',
      e: o.EPOCH,
      mm: o.MEAN_MOTION,
      ec: o.ECCENTRICITY,
      in: o.INCLINATION,
      ra: o.RA_OF_ASC_NODE,
      ap: o.ARG_OF_PERICENTER,
      ma: o.MEAN_ANOMALY,
      bs: o.BSTAR,
      md: o.MEAN_MOTION_DOT,
      rev: o.REV_AT_EPOCH,
      els: o.ELEMENT_SET_NO,
    };
  })
  .sort((a, b) => a.id - b.id);
assertPlausible('satellites', out.length);
const counts = out.reduce<Record<string, number>>((acc, s) => ((acc[s.t] = (acc[s.t] ?? 0) + 1), acc), {});
const snapshot = new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });
if (unchanged(`${OUT}/gp.json`, 'objects', out)) {
  console.log(`unchanged: ${out.length} objects match the committed snapshot`);
  process.exit(0);
}
const json = JSON.stringify({ snapshot, source: 'CelesTrak GP + SATCAT', count: out.length, types: { 0: 'payload', 1: 'rocket body', 2: 'debris', 3: 'unknown' }, objects: out });
writeFileSync(`${OUT}/gp.json`, json);
writeFileSync(
  `${OUT}/README.md`,
  `# Tracked objects

${out.length} objects (${counts[0] ?? 0} payloads, ${counts[1] ?? 0} rocket bodies, ${counts[2] ?? 0} debris, ${counts[3] ?? 0} unknown)
from CelesTrak general perturbations data (groups: ${GROUPS.join(', ')}) joined with the CelesTrak SATCAT
for object type, owner and launch date. Snapshot ${snapshot}, sha256 ${createHash('sha256').update(json).digest('hex').slice(0, 16)}.
License: CelesTrak data are provided free for public use (https://celestrak.org/NORAD/documentation/gp-data-formats.php).
Positions are propagated in the browser with SGP4 (satellite.js) from this snapshot; they drift from truth by
kilometres per day and are not a conjunction or tracking product.
`,
);
writeStatus({ orbit: { snapshot, count: out.length, updated: new Date().toISOString() } });
console.log(`wrote ${out.length} objects, ${(json.length / 1e6).toFixed(1)} MB`, counts);
