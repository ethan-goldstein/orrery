# Solar system data

## moons.json
Planet-centred state vectors (ecliptic J2000, km, km/s, geometric) for 21 moons at 2026-01-01 00:00 UTC,
retrieved 2026-09-14T19:29:49.622Z from NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/). Public domain (US Government work).
The app converts each to osculating Keplerian elements and propagates them as two-body orbits; nodal and apsidal
precession are not modelled, so positions drift from the true ephemeris over years. The Galilean moons and Earth's
Moon are computed by astronomy-engine instead.

Central-body GM values (km^3/s^2): mars 42828.375214, jupiter 126686531.9, saturn 37931206.2, uranus 5793951.3, neptune 6835100, pluto 975.5.

## spacecraft.json
Heliocentric state vectors (ecliptic J2000, km, km/s, geometric) from NASA/JPL Horizons, retrieved 2026-09-15T22:24:16.139Z, for
voyager1 (probe, 1977-09-06 to 2030-01-01, every 30 d, 638 rows); voyager2 (probe, 1977-08-21 to 2030-01-01, every 30 d, 638 rows); newhorizons (probe, 2006-01-20 to 2030-01-01, every 30 d, 292 rows); parker (probe, 2018-08-13 to 2026-12-31, every 2 d, 1532 rows); halley (comet, 1900-01-01 to 2100-01-01, every 30 d, 2435 rows); apophis (asteroid, 2000-01-01 to 2100-01-01, every 30 d, 1218 rows); bennu (asteroid, 2000-01-01 to 2100-01-01, every 30 d, 1218 rows).
Public domain (US Government work). Interpolated at runtime with cubic Hermite splines; positions between samples
are accurate to well under the drawn marker size. JWST is not fetched: it is drawn at Sun-Earth L2, 0.01 AU
anti-sunward of Earth.
