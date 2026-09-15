/**
 * Last check before the refresh workflow commits: the files on disk must be
 * valid JSON, plausibly sized and consistent with status.json.
 *   npx tsx scripts/verify-data.ts
 */
import { readFileSync, statSync } from 'node:fs';
import { assertPlausible, MIN_ROWS } from './lib/guards';
import { readStatus } from './lib/status';

const MAX_BYTES = 40 * 1024 * 1024;
const problems: string[] = [];
const check = (file: string, kind: keyof typeof MIN_ROWS, key: string) => {
  const size = statSync(file).size;
  if (size > MAX_BYTES) problems.push(`${file} is ${(size / 1e6).toFixed(1)} MB, over the 40 MB limit`);
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown[]>;
  const rows = data[key];
  if (!Array.isArray(rows)) problems.push(`${file} has no "${key}" array`);
  else {
    try {
      assertPlausible(kind, rows.length);
    } catch (e) {
      problems.push((e as Error).message);
    }
  }
  return rows?.length ?? 0;
};
const sats = check('public/data/orbit/gp.json', 'satellites', 'objects');
const quakes = check('public/data/quakes/m6.json', 'quakes', 'rows');
const status = readStatus();
if (status.orbit && status.orbit.count !== sats) problems.push(`status.json orbit.count ${status.orbit.count} != ${sats}`);
if (status.quakes && status.quakes.count !== quakes) problems.push(`status.json quakes.count ${status.quakes.count} != ${quakes}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`verified: ${sats} tracked objects, ${quakes} earthquakes`);
