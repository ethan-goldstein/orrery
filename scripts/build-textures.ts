/**
 * Texture pipeline. Downloads source maps into scripts/.cache (git-ignored),
 * resizes them to 1k/2k/4k tiers, encodes WebP (and AVIF for 1k/2k), and
 * writes public/textures/manifest.json with the license of every asset.
 *
 *   npx tsx scripts/build-textures.ts            # all
 *   npx tsx scripts/build-textures.ts earth-day  # one id
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const CACHE = join('scripts', '.cache', 'textures');
const OUT = join('public', 'textures');
mkdirSync(CACHE, { recursive: true });

const SSS = 'https://www.solarsystemscope.com/textures/download';
const SSS_LICENSE = { spdx: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
const SSS_SOURCE = (file: string) => ({ title: `Solar System Scope textures (${file})`, url: 'https://www.solarsystemscope.com/textures/' });
const SSS_ATTR = 'Solar System Scope / INOVE, CC BY 4.0';
const THREE = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets';
const THREE_LICENSE = { spdx: 'MIT', url: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE' };

interface Source {
  id: string;
  dir: string;
  colorSpace: 'srgb' | 'linear';
  /** candidate URLs in order; first that downloads wins */
  urls: string[];
  maxTier: '1k' | '2k' | '4k';
  license: { spdx: string; url: string };
  source: { title: string; url: string };
  attribution: string;
  transforms: string;
  /** keep alpha channel (rings, clouds) */
  alpha?: boolean;
  /** non-square aspect: ring strips */
  strip?: boolean;
  /** 16-bit elevation: also emit a tangent-space normal map */
  height?: boolean;
}

const sss = (id: string, file: string, dir: string, opts: Partial<Source> = {}): Source => ({
  id,
  dir,
  colorSpace: 'srgb',
  urls: [`${SSS}/${file}`],
  maxTier: file.startsWith('8k') ? '4k' : '2k',
  license: SSS_LICENSE,
  source: SSS_SOURCE(file),
  attribution: SSS_ATTR,
  transforms: 'resized to 1k/2k(/4k) equirectangular tiers, re-encoded WebP/AVIF',
  ...opts,
});

const SOURCES: Source[] = [
  sss('sun', '2k_sun.jpg', 'solar'),
  sss('mercury', '2k_mercury.jpg', 'solar'),
  sss('venus-surface', '2k_venus_surface.jpg', 'solar'),
  sss('venus-atmosphere', '2k_venus_atmosphere.jpg', 'solar'),
  sss('earth-day', '8k_earth_daymap.jpg', 'earth', { urls: [`${SSS}/8k_earth_daymap.jpg`, `${SSS}/2k_earth_daymap.jpg`, `${THREE}/earth_atmos_2048.jpg`] }),
  sss('earth-night', '8k_earth_nightmap.jpg', 'earth', { urls: [`${SSS}/8k_earth_nightmap.jpg`, `${SSS}/2k_earth_nightmap.jpg`, `${THREE}/earth_lights_2048.png`] }),
  sss('earth-clouds', '8k_earth_clouds.jpg', 'earth', { urls: [`${SSS}/8k_earth_clouds.jpg`, `${SSS}/2k_earth_clouds.jpg`, `${THREE}/earth_clouds_2048.png`], colorSpace: 'linear' }),
  sss('earth-normal', '8k_earth_normal_map.tif', 'earth', { urls: [`${SSS}/8k_earth_normal_map.tif`, `${SSS}/2k_earth_normal_map.tif`, `${THREE}/earth_normal_2048.jpg`], colorSpace: 'linear' }),
  sss('earth-specular', '8k_earth_specular_map.tif', 'earth', { urls: [`${SSS}/8k_earth_specular_map.tif`, `${SSS}/2k_earth_specular_map.tif`, `${THREE}/earth_specular_2048.jpg`], colorSpace: 'linear' }),
  sss('moon', '8k_moon.jpg', 'moon', { urls: [`${SSS}/8k_moon.jpg`, `${SSS}/2k_moon.jpg`, `${THREE}/moon_1024.jpg`] }),
  sss('mars', '8k_mars.jpg', 'solar', { urls: [`${SSS}/8k_mars.jpg`, `${SSS}/2k_mars.jpg`] }),
  sss('jupiter', '8k_jupiter.jpg', 'solar', { urls: [`${SSS}/8k_jupiter.jpg`, `${SSS}/2k_jupiter.jpg`] }),
  sss('saturn', '8k_saturn.jpg', 'solar', { urls: [`${SSS}/8k_saturn.jpg`, `${SSS}/2k_saturn.jpg`] }),
  sss('saturn-ring', '8k_saturn_ring_alpha.png', 'solar', { urls: [`${SSS}/8k_saturn_ring_alpha.png`, `${SSS}/2k_saturn_ring_alpha.png`], alpha: true, strip: true, maxTier: '4k' }),
  sss('uranus', '2k_uranus.jpg', 'solar'),
  sss('neptune', '2k_neptune.jpg', 'solar'),
  sss('milky-way', '8k_stars_milky_way.jpg', 'sky', { urls: [`${SSS}/8k_stars_milky_way.jpg`, `${SSS}/2k_stars_milky_way.jpg`] }),
  {
    id: 'moon-lroc', dir: 'moon', colorSpace: 'srgb', maxTier: '4k',
    urls: ['https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif'],
    license: { spdx: 'NASA', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
    source: { title: 'NASA SVS CGI Moon Kit, LROC WAC color mosaic', url: 'https://svs.gsfc.nasa.gov/4720' },
    attribution: 'NASA Scientific Visualization Studio / Ernie Wright; LROC WAC (Arizona State University)',
    transforms: 'resized to 1k/2k/4k tiers, re-encoded WebP/AVIF',
  },
  {
    id: 'moon-height', dir: 'moon', colorSpace: 'linear', maxTier: '4k',
    urls: ['https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif'],
    license: { spdx: 'NASA', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
    source: { title: 'NASA SVS CGI Moon Kit, LOLA elevation (16 ppd)', url: 'https://svs.gsfc.nasa.gov/4720' },
    attribution: 'NASA SVS / LOLA (Lunar Orbiter Laser Altimeter)',
    transforms: 'uint16 elevation resampled to tiers; normal map computed by central differences (moon-normal-*)',
    height: true,
  },
];

const TIER_WIDTH = { '1k': 1024, '2k': 2048, '4k': 4096 } as const;

async function download(s: Source): Promise<{ file: string; url: string; sha256: string } | null> {
  for (const url of s.urls) {
    const name = `${s.id}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}${url.slice(url.lastIndexOf('.'))}`;
    const file = join(CACHE, name);
    if (existsSync(file)) return { file, url, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'orrery-texture-pipeline (github.com/ethan-goldstein/orrery)' } });
      if (!res.ok) {
        console.warn(`  ${s.id}: ${res.status} ${url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10_000) {
        console.warn(`  ${s.id}: suspiciously small (${buf.length} B) ${url}`);
        continue;
      }
      writeFileSync(file, buf);
      return { file, url, sha256: createHash('sha256').update(buf).digest('hex') };
    } catch (e) {
      console.warn(`  ${s.id}: ${(e as Error).message} ${url}`);
    }
  }
  return null;
}

/**
 * 16-bit elevation: sharp converts to 8 bits on resize, which flattens the
 * relief, so the actual height/normal files are produced by
 * scripts/moon-normal.py (numpy). This only reserves the manifest entries.
 */
async function buildNormalMap(_file: string, w: number, h: number, dir: string, id: string, tier: string): Promise<void> {
  const target = join(dir, `${id}-${tier}.webp`);
  if (!existsSync(target)) console.warn(`  ${target} missing: run scripts/.venv/bin/python scripts/moon-normal.py`);
  void w;
  void h;
}

const only = process.argv[2];
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { generated: string; textures: Record<string, unknown>[] })
  : { generated: '', textures: [] };

for (const s of SOURCES) {
  if (only && s.id !== only) continue;
  console.log(s.id);
  const dl = await download(s);
  if (!dl) {
    console.error(`  FAILED ${s.id}: no source downloaded`);
    continue;
  }
  const img = sharp(dl.file, { limitInputPixels: false });
  const meta = await img.metadata();
  const srcW = meta.width ?? 0;
  const files: Record<string, Record<string, string>> = {};
  for (const tier of ['1k', '2k', '4k'] as const) {
    const w = TIER_WIDTH[tier];
    if (w > TIER_WIDTH[s.maxTier]) continue;
    if (w > srcW * 1.01 && tier !== '1k') continue; // never upscale
    const h = s.strip ? Math.max(8, Math.round(((meta.height ?? 1) * w) / srcW)) : w / 2;
    const dir = join(OUT, s.dir);
    mkdirSync(dir, { recursive: true });
    const base = `${s.id}-${tier}`;
    const pipeline = () => sharp(dl.file, { limitInputPixels: false }).resize(w, h, { fit: 'fill', kernel: 'lanczos3' });
    if (s.height) {
      await buildNormalMap(dl.file, w, h, dir, s.id, tier);
      files[tier] = { webp: `textures/${s.dir}/${base}.webp` };
      console.log(`  ${tier} ${w}x${h} (height + normal)`);
      continue;
    }
    const webp = join(dir, `${base}.webp`);
    await pipeline().webp({ quality: s.colorSpace === 'linear' ? 90 : 84, alphaQuality: 95, effort: 5 }).toFile(webp);
    files[tier] = { webp: `textures/${s.dir}/${base}.webp` };
    if (tier !== '4k') {
      const avif = join(dir, `${base}.avif`);
      await pipeline().avif({ quality: s.colorSpace === 'linear' ? 68 : 60, effort: 4 }).toFile(avif);
      files[tier]!.avif = `textures/${s.dir}/${base}.avif`;
    }
    console.log(`  ${tier} ${w}x${h}`);
  }
  const entry = {
    id: s.id,
    files,
    colorSpace: s.colorSpace,
    source: { ...s.source, url: dl.url },
    license: s.license,
    attribution: dl.url.startsWith(THREE) ? 'three.js examples (NASA-derived), MIT' : s.attribution,
    transforms: s.transforms,
    sourceSha256: dl.sha256,
    sourceWidth: srcW,
  };
  if (dl.url.startsWith(THREE)) entry.license = THREE_LICENSE;
  manifest.textures = manifest.textures.filter((t) => (t as { id: string }).id !== s.id && (t as { id: string }).id !== `${s.id.replace('-height', '')}-normal`);
  manifest.textures.push(entry);
  if (s.height) {
    const normalFiles: Record<string, Record<string, string>> = {};
    for (const [tier, f] of Object.entries(files)) normalFiles[tier] = { webp: f.webp!.replace(`${s.id}-`, 'moon-normal-') };
    manifest.textures.push({ ...entry, id: 'moon-normal', files: normalFiles, transforms: 'tangent-space normal map from LOLA elevation, relief x8' });
  }
}
manifest.generated = new Date().toISOString();
manifest.textures.sort((a, b) => ((a as { id: string }).id < (b as { id: string }).id ? -1 : 1));
mkdirSync(OUT, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`manifest: ${manifest.textures.length} textures`);
