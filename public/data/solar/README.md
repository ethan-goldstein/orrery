# Solar system data

## moons.json
Planet-centred state vectors (ecliptic J2000, km, km/s, geometric) for 21 moons at 2026-01-01 00:00 UTC,
retrieved 2026-09-14T19:29:49.622Z from NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/). Public domain (US Government work).
The app converts each to osculating Keplerian elements and propagates them as two-body orbits; nodal and apsidal
precession are not modelled, so positions drift from the true ephemeris over years. The Galilean moons and Earth's
Moon are computed by astronomy-engine instead.

Central-body GM values (km^3/s^2): mars 42828.375214, jupiter 126686531.9, saturn 37931206.2, uranus 5793951.3, neptune 6835100, pluto 975.5.
