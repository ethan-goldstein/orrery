import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, 'public/textures/manifest.json'), 'utf8')) as { textures: { id: string; files: Record<string, Record<string, string>>; license: { spdx: string }; source: { url: string }; attribution: string }[] };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('asset licensing', () => {
  it('every texture file on disk is declared in the manifest with a license and attribution', () => {
    const declared = new Set(manifest.textures.flatMap((t) => Object.values(t.files).flatMap((f) => Object.values(f))));
    const onDisk = walk(join(root, 'public/textures'))
      .filter((p) => !p.endsWith('manifest.json'))
      .map((p) => p.slice(join(root, 'public/').length));
    const undeclared = onDisk.filter((p) => !declared.has(p));
    expect(undeclared).toEqual([]);
    for (const t of manifest.textures) {
      expect(t.license.spdx, t.id).toBeTruthy();
      expect(t.source.url, t.id).toMatch(/^https?:\/\//);
      expect(t.attribution, t.id).toBeTruthy();
    }
  });
  it('every dataset folder documents its source and license in a README', () => {
    const dataDir = join(root, 'public/data');
    for (const d of readdirSync(dataDir)) {
      const readme = join(dataDir, d, 'README.md');
      expect(existsSync(readme), `${d}/README.md`).toBe(true);
      const text = readFileSync(readme, 'utf8').toLowerCase();
      expect(text, `${d} README names a license`).toMatch(/licen[sc]e|public domain|cc by/);
      expect(text, `${d} README names a source`).toMatch(/https?:\/\//);
    }
  });
  it('keeps every committed asset under the GitHub Pages file limit and the repo under budget', () => {
    const files = walk(join(root, 'public'));
    const total = files.reduce((n, f) => n + statSync(f).size, 0);
    for (const f of files) expect(statSync(f).size, f).toBeLessThan(50 * 1024 * 1024);
    expect(total).toBeLessThan(400 * 1024 * 1024);
  });
});
