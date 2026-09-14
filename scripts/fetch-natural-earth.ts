/**
 * Natural Earth 1:110m coastlines (public domain) as a compact line list for
 * the Civilization globe.   npx tsx scripts/fetch-natural-earth.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson';
const res = await fetch(url);
if (!res.ok) throw new Error(`natural earth ${res.status}`);
const gj = (await res.json()) as { features: { geometry: { type: string; coordinates: number[][] | number[][][] } }[] };
const lines: number[][] = [];
for (const f of gj.features) {
  const g = f.geometry;
  const parts = g.type === 'LineString' ? [g.coordinates as number[][]] : (g.coordinates as number[][][]);
  for (const part of parts) lines.push(part.flatMap(([lon, lat]) => [+lon!.toFixed(2), +lat!.toFixed(2)]));
}
mkdirSync('public/data/civ', { recursive: true });
const out = { source: 'Natural Earth 1:110m coastline', url, license: 'Public domain', lines };
writeFileSync('public/data/civ/coastlines.json', JSON.stringify(out));
writeFileSync('public/data/civ/README.md', `# Civilization data

## coastlines.json
Natural Earth 1:110m coastline (https://www.naturalearthdata.com/, public domain), via ${url}. ${lines.length} line strings, lon/lat pairs rounded to 0.01°.

## chapters.json
Eighteen chapters of the human story, written for this site. Coordinates are published locations of the sites named;
dates follow the cited sources in each chapter.
`);
console.log(`wrote ${lines.length} coastline strings`);
