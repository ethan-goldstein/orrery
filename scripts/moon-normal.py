"""
Builds lunar height and normal maps from the NASA CGI Moon Kit LOLA elevation
TIFF (uint16, 0.5 m per unit, 16 pixels per degree). Overwrites the placeholder
files that build-textures.ts registers in the manifest.

    scripts/.venv/bin/python scripts/moon-normal.py
"""
import glob, os
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

src = next(f for f in glob.glob('scripts/.cache/textures/moon-height-*.tif'))
img = Image.open(src)
arr = np.array(img, dtype=np.float32)
print('source', arr.shape, img.mode, float(arr.min()), float(arr.max()))
metres = arr * 0.5
out = 'public/textures/moon'
for tier, w in (('1k', 1024), ('2k', 2048), ('4k', 4096)):
    h = w // 2
    z = np.array(Image.fromarray(metres).resize((w, h), Image.LANCZOS), dtype=np.float32)
    circumference = 2 * np.pi * 1737400.0
    dx_m = circumference / w
    dy_m = (circumference / 2) / h
    lat = (0.5 - (np.arange(h) + 0.5) / h) * np.pi
    latscale = np.maximum(0.15, np.cos(lat))[:, None]
    dzdx = (np.roll(z, -1, axis=1) - np.roll(z, 1, axis=1)) / (2 * dx_m * latscale)
    dzdy = np.zeros_like(z)
    dzdy[1:-1] = (z[2:] - z[:-2]) / (2 * dy_m)
    strength = 6.0
    nx = -dzdx * strength
    ny = -dzdy * strength  # image y grows south; tangent-space +y = north
    nz = np.ones_like(z)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack([nx / length, ny / length, nz / length], axis=-1)
    rgb = np.clip((normal * 0.5 + 0.5) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').save(f'{out}/moon-normal-{tier}.webp', 'WEBP', quality=92, method=6)
    hq = np.clip((z - z.min()) / (z.max() - z.min()) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(hq, 'L').save(f'{out}/moon-height-{tier}.webp', 'WEBP', quality=90, method=6)
    print(tier, w, h, 'slope p95', float(np.percentile(np.abs(dzdx), 95)))
