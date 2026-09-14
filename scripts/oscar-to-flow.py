"""
OSCAR surface currents (NASA/JPL PO.DAAC, via NOAA CoastWatch ERDDAP, no login)
encoded as a flow texture for the Oceans page.

    scripts/.venv/bin/python scripts/oscar-to-flow.py [YYYY-MM-DD]

Output: public/data/oceans/flow-<date>.png  RGBA, 1024 x 512, equirectangular -180..180 / 90..-90
        R = u (east) mapped from -1.5..1.5 m/s, G = v (north), B = speed / 2 m/s, A = 255 where data exists
"""
import json, os, sys, urllib.request
import numpy as np
import netCDF4
from PIL import Image

date = sys.argv[1] if len(sys.argv) > 1 else '2014-09-26'
cache = f'scripts/.cache/oceans/oscar-{date}.nc'
url = ('https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplOscar.nc?'
       f'u[({date}T00:00:00Z)][(15.0)][(80.0):(-80.0)][(20.0):(420.0)],'
       f'v[({date}T00:00:00Z)][(15.0)][(80.0):(-80.0)][(20.0):(420.0)]')
if not os.path.exists(cache):
    print('downloading', url)
    urllib.request.urlretrieve(url, cache)
d = netCDF4.Dataset(cache)
u = np.array(d.variables['u'][0, 0], dtype=np.float32)
v = np.array(d.variables['v'][0, 0], dtype=np.float32)
lat = np.array(d.variables['latitude'][:])
lon = np.array(d.variables['longitude'][:])
print('grid', u.shape, 'lat', lat[0], lat[-1], 'lon', lon[0], lon[-1])
if lat[0] < lat[-1]:
    u, v, lat = u[::-1], v[::-1], lat[::-1]
# longitude 20..420 -> roll to -180..180 (drop the duplicated 20..60 tail beyond 380)
lon_wrapped = ((lon + 180) % 360) - 180
order = np.argsort(lon_wrapped, kind='stable')
u, v, lonw = u[:, order], v[:, order], lon_wrapped[order]
# remove duplicate longitudes (20..60 appear twice)
keep = np.concatenate([[True], np.diff(lonw) > 1e-6])
u, v, lonw = u[:, keep], v[:, keep], lonw[keep]
mask = np.isfinite(u) & np.isfinite(v)
u = np.where(mask, u, 0.0)
v = np.where(mask, v, 0.0)
# pad latitude 80..-80 into a full 90..-90 canvas
H, W = 512, 1024
def resample(a, mode):
    img = Image.fromarray(a.astype(np.float32), mode='F').resize((W, int(round(H * 160 / 180))), Image.BILINEAR)
    arr = np.array(img)
    top = int(round(H * 10 / 180))
    out = np.zeros((H, W), dtype=np.float32)
    out[top:top + arr.shape[0]] = arr
    return out
U = resample(u, 'F'); V = resample(v, 'F'); M = resample(mask.astype(np.float32), 'F') > 0.5
speed = np.sqrt(U * U + V * V)
rgba = np.zeros((H, W, 4), dtype=np.uint8)
rgba[..., 0] = np.clip((U / 3.0 + 0.5) * 255, 0, 255)
rgba[..., 1] = np.clip((V / 3.0 + 0.5) * 255, 0, 255)
rgba[..., 2] = np.clip(speed / 2.0 * 255, 0, 255)
rgba[..., 3] = np.where(M, 255, 0)
os.makedirs('public/data/oceans', exist_ok=True)
Image.fromarray(rgba, 'RGBA').save(f'public/data/oceans/flow-{date}.png', optimize=True)
meta = {'date': date, 'source': 'OSCAR third-degree sea surface velocity (JPL/PO.DAAC) via NOAA CoastWatch ERDDAP jplOscar',
        'url': 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplOscar.html', 'license': 'NASA / NOAA public domain',
        'encoding': 'R=(u/3+0.5), G=(v/3+0.5) in m/s, B=speed/2, A=valid; equirectangular -180..180 x 90..-90',
        'width': W, 'height': H, 'maxSpeed': float(np.nanmax(speed)), 'meanSpeed': float(speed[M].mean())}
json.dump(meta, open('public/data/oceans/index.json', 'w'), indent=1)
open('public/data/oceans/README.md', 'w').write(f"""# Ocean surface currents

OSCAR (Ocean Surface Current Analyses Real-time) third-degree sea surface velocity for {date}, a 5-day composite
from NASA/JPL PO.DAAC (https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_third-deg), retrieved through NOAA CoastWatch ERDDAP
(https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplOscar.html, no login required).
Public domain (US Government work). Encoded as a {W} x {H} RGBA flow texture: {meta['encoding']}.
Max speed {meta['maxSpeed']:.2f} m/s, mean {meta['meanSpeed']:.2f} m/s. The Oceans page advects particles through this
field; trails are accelerated for legibility.
""")
print('wrote flow texture, max speed', meta['maxSpeed'], 'mean', meta['meanSpeed'])
