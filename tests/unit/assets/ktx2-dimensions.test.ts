import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Manifest {
  textures: { id: string; files: Record<string, { ktx2?: string }> }[];
}

const manifest = JSON.parse(readFileSync('public/textures/manifest.json', 'utf8')) as Manifest;
const KTX2_MAGIC = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

describe('KTX2 textures', () => {
  it('have base dimensions that are multiples of 4, as block-compressed GPU formats require', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const t of manifest.textures) {
      for (const [tier, f] of Object.entries(t.files)) {
        if (!f.ktx2) continue;
        const buf = readFileSync(join('public', f.ktx2));
        expect([...buf.subarray(0, 12)], `${f.ktx2} is not a KTX2 file`).toEqual(KTX2_MAGIC);
        const width = buf.readUInt32LE(20);
        const height = buf.readUInt32LE(24);
        checked++;
        if (width % 4 !== 0 || height % 4 !== 0) bad.push(`${t.id} ${tier} ${width}x${height}`);
      }
    }
    expect(checked).toBeGreaterThan(20);
    expect(bad, `re-encode with scripts/build-ktx2.ts: ${bad.join(', ')}`).toEqual([]);
  });
});
