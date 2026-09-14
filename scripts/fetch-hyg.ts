/**
 * Downloads the HYG star database (CC BY-SA 4.0, David Nash / Astronomy Nexus),
 * keeps stars brighter than magnitude 6.5 and writes a compact binary for the
 * starfield plus a README with provenance.
 *
 *   npm run data:hyg
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eqjToScene, raDecToEqj } from '../src/astro/frames';

const CANDIDATES = [
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv',
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v42.csv',
];
const MAG_LIMIT = 6.5;
const OUT_DIR = join(process.cwd(), 'public', 'data', 'stars');

async function download(): Promise<{ url: string; text: string }> {
  for (const url of CANDIDATES) {
    const res = await fetch(url);
    if (res.ok) return { url, text: await res.text() };
    console.warn(`skip ${url}: ${res.status}`);
  }
  throw new Error('No HYG candidate URL succeeded');
}

const { url, text } = await download();
const sha256 = createHash('sha256').update(text).digest('hex');
const lines = text.split('\n');
const unq = (v: string | undefined) => (v ?? '').replace(/^"|"$/g, '');
const header = lines[0]!.split(',').map(unq);
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`column ${name} missing; header: ${header.join(',')}`);
  return i;
};
const iRa = col('ra');
const iDec = col('dec');
const iMag = col('mag');
const iCi = col('ci');
const iProper = header.indexOf('proper');

type Star = { v: [number, number, number]; mag: number; bv: number; name: string };
const stars: Star[] = [];
for (let i = 1; i < lines.length; i++) {
  const row = lines[i]!.split(',').map(unq);
  if (row.length < header.length) continue;
  const mag = Number(row[iMag]);
  if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue;
  const ra = Number(row[iRa]);
  const dec = Number(row[iDec]);
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
  const bvRaw = Number(row[iCi]);
  const bv = Number.isFinite(bvRaw) ? bvRaw : 0.6;
  // HYG row 0 is the Sun (ra 0, dec 0, mag -26.7); skip it.
  if (mag < -20) continue;
  stars.push({ v: eqjToScene(raDecToEqj(ra, dec)), mag, bv, name: iProper >= 0 ? row[iProper] ?? '' : '' });
}
stars.sort((a, b) => a.mag - b.mag);

const buf = new Float32Array(stars.length * 5);
stars.forEach((s, i) => {
  buf.set([s.v[0], s.v[1], s.v[2], s.mag, s.bv], i * 5);
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'hyg.bin'), Buffer.from(buf.buffer));
const named = stars.filter((s) => s.name).slice(0, 300).map((s) => ({ name: s.name, mag: +s.mag.toFixed(2), v: s.v.map((x) => +x.toFixed(5)) }));
writeFileSync(join(OUT_DIR, 'named.json'), JSON.stringify(named));
const meta = {
  source: { title: 'HYG Database v4 (astronexus)', url, homepage: 'https://www.astronexus.com/projects/hyg' },
  license: { spdx: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  attribution: 'David Nash / Astronomy Nexus, HYG Database, CC BY-SA 4.0',
  retrieved: new Date().toISOString(),
  sha256,
  magnitudeLimit: MAG_LIMIT,
  count: stars.length,
  layout: 'Float32 x5 per star: scene x, y, z (unit vector, ecliptic J2000 Y-up), visual magnitude, B-V',
};
writeFileSync(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
writeFileSync(
  join(OUT_DIR, 'README.md'),
  `# Star catalog

Derived from the HYG Database v4 by David Nash (Astronomy Nexus), retrieved ${meta.retrieved} from
${url} (sha256 ${sha256}).

License: **CC BY-SA 4.0**. This derived file (stars brighter than magnitude ${MAG_LIMIT}, ${stars.length} stars,
positions rotated into the ecliptic J2000 frame) is likewise shared under CC BY-SA 4.0.

Layout of hyg.bin: ${meta.layout}.
`,
);
console.log(`wrote ${stars.length} stars from ${url}`);
