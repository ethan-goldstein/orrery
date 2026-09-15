import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

/** Every asset URL goes through here so GitHub Pages subpaths work. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return base + path.replace(/^\//, '');
}

export type TextureTier = '1k' | '2k' | '4k';

export interface ManifestEntry {
  id: string;
  files: Partial<Record<TextureTier, { avif?: string; webp?: string; jpg?: string; png?: string; ktx2?: string }>>;
  colorSpace: 'srgb' | 'linear';
  source: { title: string; url: string };
  license: { spdx: string; url?: string };
  attribution: string;
  transforms?: string;
}

export interface Manifest {
  generated: string;
  textures: ManifestEntry[];
}

let manifestPromise: Promise<Manifest> | null = null;
const cache = new Map<string, Promise<THREE.Texture>>();
const loader = new THREE.TextureLoader();
// ImageBitmap decodes off the main thread; fall back to <img> where unsupported (old Safari)
const bitmapLoader = typeof createImageBitmap === 'function' ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : null;
let avifSupported: Promise<boolean> | null = null;
let ktx2: KTX2Loader | null = null;
let ktx2Ready = false;
let ktx2Loaded = 0;
export const ktx2LoadedCount = (): number => ktx2Loaded;

/**
 * Enable GPU-compressed textures. Call once with the renderer; until then, and
 * on GPUs without a supported transcode target, the WebP/AVIF path is used.
 */
export function enableKtx2(renderer: THREE.WebGLRenderer): void {
  if (ktx2) return;
  try {
    ktx2 = new KTX2Loader().setTranscoderPath(assetUrl('basis/')).setWorkerLimit(2).detectSupport(renderer);
    ktx2Ready = true;
  } catch {
    ktx2 = null;
    ktx2Ready = false;
  }
}

export function ktx2Enabled(): boolean {
  return ktx2Ready;
}

export function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetch(assetUrl('textures/manifest.json')).then((r) => {
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    return r.json() as Promise<Manifest>;
  });
  return manifestPromise;
}

function supportsAvif(): Promise<boolean> {
  avifSupported ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0);
    img.onerror = () => resolve(false);
    img.src =
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });
  return avifSupported;
}

/** Load a manifest texture at the requested tier, falling back to lower tiers and formats. */
export async function loadTexture(id: string, tier: TextureTier): Promise<THREE.Texture> {
  const key = `${id}@${tier}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const manifest = await loadManifest();
      const entry = manifest.textures.find((t) => t.id === id);
      if (!entry) throw new Error(`Texture "${id}" is not in textures/manifest.json`);
      const order: TextureTier[] = tier === '4k' ? ['4k', '2k', '1k'] : tier === '2k' ? ['2k', '1k'] : ['1k', '2k'];
      const files = order.map((t) => entry.files[t]).find(Boolean);
      if (!files) throw new Error(`Texture "${id}" has no files`);
      const avif = await supportsAvif();
      let tex: THREE.Texture;
      if (ktx2 && ktx2Ready && files.ktx2) {
        // GPU-compressed: 4-8x less VRAM, no decode on the main thread, mips baked in
        tex = await ktx2.loadAsync(assetUrl(files.ktx2));
        tex.colorSpace = entry.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        tex.anisotropy = 8;
        (tex as THREE.Texture & { userData: Record<string, unknown> }).userData.format = 'ktx2';
        ktx2Loaded++;
        document.querySelector<HTMLCanvasElement>('canvas.orrery-canvas')?.setAttribute('data-ktx2-loaded', String(ktx2Loaded));
        return tex;
      }
      const file = (avif && files.avif) || files.webp || files.jpg || files.png;
      if (!file) throw new Error(`Texture "${id}" has no usable format`);
      if (bitmapLoader) {
        const bitmap = await bitmapLoader.loadAsync(assetUrl(file));
        tex = new THREE.Texture(bitmap);
        tex.flipY = false;
        tex.needsUpdate = true;
      } else {
        tex = await loader.loadAsync(assetUrl(file));
      }
      tex.colorSpace = entry.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      tex.anisotropy = 8;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      return tex;
    })();
    cache.set(key, p);
  }
  return p;
}

export function releaseTexture(id: string, tier: TextureTier): void {
  const key = `${id}@${tier}`;
  const p = cache.get(key);
  if (!p) return;
  cache.delete(key);
  p.then((t) => t.dispose()).catch(() => undefined);
}
