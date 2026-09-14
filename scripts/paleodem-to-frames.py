"""
Encodes the PALEOMAP PaleoDEMs (Scotese & Wright 2018, CC BY 4.0) into 8-bit
WebP height frames for the deep-time Earth shader.

    scripts/.venv/bin/python scripts/paleodem-to-frames.py

Input:  scripts/.cache/paleo/nc/**/*.nc   (3601 x 1801 float32 metres, 6 arcmin)
Output: public/data/paleo/frames/<age>.webp  value = (h + 12000) / 20000 * 255
        public/data/paleo/index.json, README.md
"""
import glob, json, os, re, sys
import numpy as np
import netCDF4
from PIL import Image

W, H = 1536, 768
SRC = glob.glob('scripts/.cache/paleo/nc/**/*.nc', recursive=True)
OUT = 'public/data/paleo/frames'
os.makedirs(OUT, exist_ok=True)

by_age = {}
for f in sorted(SRC):
    m = re.search(r'_(\d+(?:\.\d+)?)Ma\.nc$', os.path.basename(f))
    if not m:
        continue
    age = float(m.group(1))
    by_age.setdefault(age, f)  # first file wins for duplicate ages

ages = sorted(by_age)
print(f'{len(ages)} ages, {ages[0]}..{ages[-1]} Ma')
frames = []
for age in ages:
    d = netCDF4.Dataset(by_age[age])
    z = np.array(d.variables['z'][:], dtype=np.float32)
    lat = np.array(d.variables['latitude'][:])
    if lat[0] < lat[-1]:
        z = z[::-1]  # image rows run north to south
    z = np.nan_to_num(z, nan=-6000.0)
    q = np.clip((z + 12000.0) / 20000.0 * 255.0, 0, 255)
    img = Image.fromarray(q.astype(np.uint8), mode='L').resize((W, H), Image.LANCZOS)
    name = f'{int(age) if age.is_integer() else age}.webp'
    img.save(os.path.join(OUT, name), 'WEBP', quality=92, method=6)
    frames.append({'ma': age, 'file': f'data/paleo/frames/{name}'})
    sys.stdout.write(f'\r  {age:>6} Ma  {name:>10}')
print()
total = sum(os.path.getsize(os.path.join(OUT, os.path.basename(f["file"]))) for f in frames)
index = {
    'source': 'Scotese, C.R. & Wright, N. (2018) PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the Phanerozoic',
    'url': 'https://zenodo.org/records/5460860',
    'license': 'CC-BY-4.0',
    'encoding': 'elevation_m = value / 255 * 20000 - 12000',
    'width': W, 'height': H,
    'frames': frames,
}
json.dump(index, open('public/data/paleo/index.json', 'w'))
open('public/data/paleo/README.md', 'w').write(f"""# PaleoDEM frames

{len(frames)} elevation frames, 0 to 540 Ma at 5 Myr steps, from Scotese, C.R. & Wright, N. (2018)
*PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the Phanerozoic*, https://zenodo.org/records/5460860.
License: **CC BY 4.0**. Resampled from 6 arcminutes (3601 x 1801) to {W} x {H} and quantised to 8 bits:
elevation_m = value / 255 * 20000 - 12000 (about 78 m per step). Total {total/1e6:.1f} MB.
""")
print(f'wrote {len(frames)} frames, {total/1e6:.1f} MB')
