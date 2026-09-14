import * as THREE from 'three';

/** Every asset URL goes through here so GitHub Pages subpaths work. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return base + path.replace(/^\//, '');
}

export type TextureTier = '1k' | '2k' | '4k';

export interface ManifestEntry {
  id: string;
  files: Partial<Record<TextureTier, { avif?: string; webp?: string; jpg?: string; png?: string }>>;
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
let avifSupported: Promise<boolean> | null = null;

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
      const file = (avif && files.avif) || files.webp || files.jpg || files.png;
      if (!file) throw new Error(`Texture "${id}" has no usable format`);
      const tex = await loader.loadAsync(assetUrl(file));
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
