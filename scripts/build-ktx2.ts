/**
 * Encodes every manifest texture tier to KTX2 (Basis Universal) with the
 * official WebAssembly encoder, so no native toolchain is needed.
 *   npx tsx scripts/build-ktx2.ts [id]      (encoder files in scripts/.cache/basis)
 *
 * Colour maps: ETC1S (small, transcodes everywhere). Normal maps: UASTC with
 * renormalised mips (ETC1S smears normals). Mips are baked in; sRGB flagged.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const CACHE = join('scripts', '.cache', 'basis');
const manifestPath = join('public', 'textures', 'manifest.json');
interface Entry { id: string; colorSpace: 'srgb' | 'linear'; files: Record<string, { webp?: string; ktx2?: string }>; alpha?: boolean }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { textures: Entry[] };
const only = process.argv[2];

const BASIS = require(resolve(CACHE, 'basis_encoder.js')) as (opts: Record<string, unknown>) => Promise<BasisModule>;
interface BasisModule { initializeBasis(): void; BasisEncoder: new () => BasisEncoder }
interface BasisEncoder {
  setSliceSourceImage(i: number, data: Uint8Array, w: number, h: number, isPng: boolean): boolean;
  setCreateKTX2File(v: boolean): void; setKTX2UASTCSupercompression(v: boolean): void; setKTX2AndBasisSRGBTransferFunc(v: boolean): void;
  setUASTC(v: boolean): void; setPackUASTCFlags(v: number): void; setRDOUASTC(v: boolean): void; setRDOUASTCQualityScalar(v: number): void;
  setQualityLevel(v: number): void; setETC1SCompressionLevel(v: number): void; setPerceptual(v: boolean): void;
  setMipGen(v: boolean): void; setMipSRGB(v: boolean): void; setMipRenormalize(v: boolean): void; setRenormalize(v: boolean): void;
  setCheckForAlpha(v: boolean): void; setNormalMapPreset(): void; setDebug(v: boolean): void; setComputeStats(v: boolean): void;
  encode(dst: Uint8Array): number; delete(): void;
}

const M = await BASIS({ locateFile: (p: string) => resolve(CACHE, p) });
M.initializeBasis();

const NORMAL = new Set(['earth-normal', 'moon-normal']);
const t0 = Date.now();
let done = 0;
let bytes = 0;
for (const entry of manifest.textures) {
  if (only && entry.id !== only) continue;
  for (const tier of ['1k', '2k', '4k']) {
    const f = entry.files[tier];
    if (!f?.webp) continue;
    const out = f.webp.replace(/\.webp$/, '.ktx2');
    const outPath = join('public', out);
    if (existsSync(outPath) && !only) {
      f.ktx2 = out;
      continue;
    }
    const start = Date.now();
    const { data, info } = await sharp(join('public', f.webp)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const enc = new M.BasisEncoder();
    const srgb = entry.colorSpace === 'srgb';
    enc.setCreateKTX2File(true);
    enc.setKTX2AndBasisSRGBTransferFunc(srgb);
    enc.setPerceptual(srgb);
    enc.setMipGen(true);
    enc.setMipSRGB(srgb);
    enc.setCheckForAlpha(true);
    if (NORMAL.has(entry.id)) {
      enc.setUASTC(true);
      enc.setKTX2UASTCSupercompression(true);
      enc.setPackUASTCFlags(2); // quality 2 of 4: good normals at sane encode time
      enc.setRDOUASTC(true);
      enc.setRDOUASTCQualityScalar(1.0);
      enc.setMipRenormalize(true);
      enc.setRenormalize(true);
    } else {
      enc.setUASTC(false);
      enc.setQualityLevel(entry.id.startsWith('earth') || entry.id.startsWith('moon') ? 255 : 210);
      enc.setETC1SCompressionLevel(2);
    }
    if (!enc.setSliceSourceImage(0, new Uint8Array(data.buffer, data.byteOffset, data.length), info.width, info.height, false)) throw new Error(`slice failed ${entry.id} ${tier}`);
    const dst = new Uint8Array(info.width * info.height * 4 + 4 * 1024 * 1024);
    const n = enc.encode(dst);
    enc.delete();
    if (n <= 0) throw new Error(`encode failed ${entry.id} ${tier}`);
    writeFileSync(outPath, dst.subarray(0, n));
    f.ktx2 = out;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
    done++;
    bytes += n;
    console.log(`${entry.id.padEnd(18)} ${tier} ${info.width}x${info.height} -> ${(n / 1024).toFixed(0)} KB in ${((Date.now() - start) / 1000).toFixed(0)}s`);
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`encoded ${done} files, ${(bytes / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
