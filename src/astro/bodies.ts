/**
 * Catalog of bodies. Physical data from the NASA planetary fact sheets
 * (https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and JPL satellite
 * physical parameters (https://ssd.jpl.nasa.gov/sats/phys_par/).
 * Radii in km, masses in kg, periods in days, day = sidereal rotation in hours.
 */
export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon';

export interface Ring {
  innerKm: number;
  outerKm: number;
  /** manifest texture id for a radial alpha strip, or null for a procedural band */
  texture: string | null;
  color: string;
  opacity: number;
}

export interface BodyInfo {
  id: string;
  name: string;
  kind: BodyKind;
  parent: string | null;
  radiusKm: number;
  /** polar flattening (1 - polar/equatorial) */
  flattening?: number;
  massKg: number;
  dayHours: number | null;
  periodDays: number | null;
  gravity: number | null;
  /** mean surface or 1-bar temperature, K */
  temperatureK: number | null;
  /** display radius in scene units when the scale is illustrated */
  illustratedRadiusUnits: number;
  color: string;
  texture: string | null;
  /** longitude of the texture's centre column, degrees (0 for most maps) */
  textureOffsetDeg?: number;
  atmosphere?: { color: string; thickness: number; twilight?: string };
  rings?: Ring[];
  emissive?: boolean;
  tagline: string;
  facts: string[];
}

const B = (b: BodyInfo): BodyInfo => b;

export const BODIES: BodyInfo[] = [
  B({ id: 'sun', name: 'Sun', kind: 'star', parent: null, radiusKm: 695_700, massKg: 1.9885e30, dayHours: 609.12, periodDays: null, gravity: 274, temperatureK: 5772, illustratedRadiusUnits: 14_000, color: '#ffd27a', texture: 'sun', emissive: true, tagline: 'One star.', facts: ['Holds 99.86% of the mass of the Solar System.', 'Light takes 8 minutes 19 seconds to reach Earth.', 'Its surface is 5,772 K; its corona runs over a million.'] }),
  B({ id: 'mercury', name: 'Mercury', kind: 'planet', parent: 'sun', radiusKm: 2439.7, massKg: 3.3011e23, dayHours: 1407.6, periodDays: 87.969, gravity: 3.7, temperatureK: 440, illustratedRadiusUnits: 2200, color: '#9a938c', texture: 'mercury', tagline: 'Scorched and swift.', facts: ['A day on Mercury lasts 176 Earth days, two of its years.', 'Surface temperature swings from 100 K at night to 700 K by day.', 'Its iron core fills 85% of its radius.'] }),
  B({ id: 'venus', name: 'Venus', kind: 'planet', parent: 'sun', radiusKm: 6051.8, massKg: 4.8675e24, dayHours: -5832.5, periodDays: 224.701, gravity: 8.87, temperatureK: 737, illustratedRadiusUnits: 3300, color: '#e6c58e', texture: 'venus-atmosphere', atmosphere: { color: '#f0d9a8', thickness: 0.04 }, tagline: 'Our hotter twin.', facts: ['Rotates backwards, once every 243 days.', 'Surface pressure is 92 times Earth’s, hot enough to melt lead.', 'Clouds of sulfuric acid reflect 75% of sunlight.'] }),
  B({ id: 'earth', name: 'Earth', kind: 'planet', parent: 'sun', radiusKm: 6371.0, flattening: 0.00335, massKg: 5.9722e24, dayHours: 23.9345, periodDays: 365.256, gravity: 9.81, temperatureK: 288, illustratedRadiusUnits: 3500, color: '#4f8fd6', texture: 'earth-day', atmosphere: { color: '#6fb1ff', thickness: 0.035, twilight: '#ff7a3d' }, tagline: 'Home.', facts: ['The only world known to hold liquid water at the surface.', '71% ocean, with a thin 100 km skin of breathable air.', 'Its Moon is the largest relative to its planet in the Solar System.'] }),
  B({ id: 'mars', name: 'Mars', kind: 'planet', parent: 'sun', radiusKm: 3389.5, flattening: 0.00589, massKg: 6.4171e23, dayHours: 24.6229, periodDays: 686.98, gravity: 3.71, temperatureK: 210, illustratedRadiusUnits: 2600, color: '#c1613f', texture: 'mars', atmosphere: { color: '#d9a07a', thickness: 0.015 }, tagline: 'The red frontier.', facts: ['Olympus Mons rises 22 km, nearly three Everests.', 'A day is 24 hours 37 minutes, close to ours.', 'Dust storms can wrap the whole planet for weeks.'] }),
  B({ id: 'jupiter', name: 'Jupiter', kind: 'planet', parent: 'sun', radiusKm: 69_911, flattening: 0.06487, massKg: 1.8982e27, dayHours: 9.925, periodDays: 4332.59, gravity: 24.79, temperatureK: 165, illustratedRadiusUnits: 9000, color: '#d5b28e', texture: 'jupiter', atmosphere: { color: '#e8d2b0', thickness: 0.012 }, rings: [{ innerKm: 122_500, outerKm: 129_000, texture: null, color: '#c9b79a', opacity: 0.08 }], tagline: 'King of worlds.', facts: ['Twice the mass of every other planet combined.', 'The Great Red Spot has raged for at least 190 years.', 'Its day is under ten hours, the shortest of any planet.'] }),
  B({ id: 'saturn', name: 'Saturn', kind: 'planet', parent: 'sun', radiusKm: 58_232, flattening: 0.09796, massKg: 5.6834e26, dayHours: 10.656, periodDays: 10_759.22, gravity: 10.44, temperatureK: 134, illustratedRadiusUnits: 7800, color: '#e3cf9d', texture: 'saturn', atmosphere: { color: '#f2e3bb', thickness: 0.012 }, rings: [{ innerKm: 74_500, outerKm: 140_220, texture: 'saturn-ring', color: '#e8dcc0', opacity: 1 }], tagline: 'The jewel.', facts: ['Its rings are mostly water ice, some pieces as big as houses, yet only about 10 m thick.', 'Less dense than water.', 'Titan, its largest moon, has rivers and seas of methane.'] }),
  B({ id: 'uranus', name: 'Uranus', kind: 'planet', parent: 'sun', radiusKm: 25_362, flattening: 0.0229, massKg: 8.681e25, dayHours: -17.24, periodDays: 30_688.5, gravity: 8.87, temperatureK: 76, illustratedRadiusUnits: 5200, color: '#9fd8e0', texture: 'uranus', atmosphere: { color: '#bfeef2', thickness: 0.012 }, rings: [{ innerKm: 41_837, outerKm: 51_149, texture: null, color: '#8fa0a8', opacity: 0.35 }], tagline: 'Tipped on its side.', facts: ['Its axis is tilted 98°; each pole gets 42 years of daylight.', 'The coldest planetary atmosphere, 49 K.', 'Thirteen faint, dark rings.'] }),
  B({ id: 'neptune', name: 'Neptune', kind: 'planet', parent: 'sun', radiusKm: 24_622, flattening: 0.0171, massKg: 1.02413e26, dayHours: 16.11, periodDays: 60_182, gravity: 11.15, temperatureK: 72, illustratedRadiusUnits: 5100, color: '#4d6fd9', texture: 'neptune', atmosphere: { color: '#7d9cff', thickness: 0.012 }, rings: [{ innerKm: 53_200, outerKm: 62_930, texture: null, color: '#8892b0', opacity: 0.2 }], tagline: 'Wind and ice at the edge.', facts: ['Winds reach 2,100 km/h, the fastest in the Solar System.', 'Found by mathematics before it was seen, in 1846.', 'Has completed one orbit since its discovery.'] }),
  B({ id: 'pluto', name: 'Pluto', kind: 'dwarf', parent: 'sun', radiusKm: 1188.3, massKg: 1.303e22, dayHours: -153.29, periodDays: 90_560, gravity: 0.62, temperatureK: 44, illustratedRadiusUnits: 1500, color: '#cdb59b', texture: null, tagline: 'The far frontier.', facts: ['A heart-shaped nitrogen glacier, Sputnik Planitia, covers a region the size of Texas.', 'Charon is so large the pair orbit a point between them.', 'Sunlight there is 1,600 times fainter than on Earth.'] }),

  B({ id: 'moon', name: 'Moon', kind: 'moon', parent: 'earth', radiusKm: 1737.4, massKg: 7.346e22, dayHours: 655.72, periodDays: 27.3217, gravity: 1.62, temperatureK: 250, illustratedRadiusUnits: 1200, color: '#b8b5ad', texture: 'moon', tagline: 'Our nearest other world.', facts: ['384,400 km away on average, drifting 3.8 cm farther each year.', 'Tidally locked: we always see the same face.', 'Twelve people have walked on it.'] }),
  B({ id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', radiusKm: 11.1, massKg: 1.06e16, dayHours: 7.65, periodDays: 0.3189, gravity: 0.0057, temperatureK: 233, illustratedRadiusUnits: 60, color: '#8c7f74', texture: null, tagline: 'Falling inward.', facts: ['Orbits faster than Mars rotates, rising in the west.', 'Will crash or break into a ring within 50 million years.'] }),
  B({ id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', radiusKm: 6.2, massKg: 1.5e15, dayHours: 30.3, periodDays: 1.2624, gravity: 0.003, temperatureK: 233, illustratedRadiusUnits: 40, color: '#9c8f82', texture: null, tagline: 'The outer companion.', facts: ['Smaller than most cities.', 'Its surface is coated in fine, smooth dust.'] }),
  B({ id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', radiusKm: 1821.6, massKg: 8.93e22, dayHours: 42.46, periodDays: 1.769, gravity: 1.8, temperatureK: 110, illustratedRadiusUnits: 700, color: '#d9c15a', texture: null, tagline: 'The volcanic moon.', facts: ['The most volcanically active body known, with 400 volcanoes.', 'Tidal flexing heats its interior.'] }),
  B({ id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', radiusKm: 1560.8, massKg: 4.8e22, dayHours: 85.23, periodDays: 3.551, gravity: 1.31, temperatureK: 102, illustratedRadiusUnits: 650, color: '#c9b9a3', texture: null, tagline: 'An ocean under ice.', facts: ['Holds twice the water of all Earth’s oceans beneath its shell.', 'Europa Clipper arrives in 2030.'] }),
  B({ id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', radiusKm: 2634.1, massKg: 1.48e23, dayHours: 171.7, periodDays: 7.155, gravity: 1.43, temperatureK: 110, illustratedRadiusUnits: 800, color: '#a59683', texture: null, tagline: 'The largest moon.', facts: ['Bigger than Mercury.', 'The only moon with its own magnetic field.'] }),
  B({ id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', radiusKm: 2410.3, massKg: 1.08e23, dayHours: 400.5, periodDays: 16.689, gravity: 1.24, temperatureK: 134, illustratedRadiusUnits: 780, color: '#6f665d', texture: null, tagline: 'The ancient face.', facts: ['The most heavily cratered surface in the Solar System.', 'Geologically dead for four billion years.'] }),
  B({ id: 'mimas', name: 'Mimas', kind: 'moon', parent: 'saturn', radiusKm: 198.2, massKg: 3.75e19, dayHours: 22.6, periodDays: 0.942, gravity: 0.064, temperatureK: 64, illustratedRadiusUnits: 220, color: '#bcbcb8', texture: null, tagline: 'The Death Star moon.', facts: ['Herschel crater spans a third of its diameter.', 'May hide a young ocean.'] }),
  B({ id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', radiusKm: 252.1, massKg: 1.08e20, dayHours: 32.9, periodDays: 1.37, gravity: 0.113, temperatureK: 75, illustratedRadiusUnits: 240, color: '#e8ecef', texture: null, tagline: 'The geyser moon.', facts: ['Sprays water into space from its south pole.', 'The brightest surface in the Solar System.'] }),
  B({ id: 'tethys', name: 'Tethys', kind: 'moon', parent: 'saturn', radiusKm: 531.1, massKg: 6.17e20, dayHours: 45.3, periodDays: 1.888, gravity: 0.146, temperatureK: 86, illustratedRadiusUnits: 320, color: '#d3d3cf', texture: null, tagline: 'Ice, almost pure.', facts: ['Ithaca Chasma runs three quarters of the way around it.'] }),
  B({ id: 'dione', name: 'Dione', kind: 'moon', parent: 'saturn', radiusKm: 561.4, massKg: 1.1e21, dayHours: 65.7, periodDays: 2.737, gravity: 0.232, temperatureK: 87, illustratedRadiusUnits: 330, color: '#c7c5bf', texture: null, tagline: 'Wispy cliffs of ice.', facts: ['Bright ice cliffs hundreds of metres tall streak its trailing side.'] }),
  B({ id: 'rhea', name: 'Rhea', kind: 'moon', parent: 'saturn', radiusKm: 763.8, massKg: 2.31e21, dayHours: 108.4, periodDays: 4.518, gravity: 0.264, temperatureK: 76, illustratedRadiusUnits: 380, color: '#bdbab4', texture: null, tagline: 'Saturn’s second largest.', facts: ['May have had its own faint ring.'] }),
  B({ id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', radiusKm: 2574.7, massKg: 1.345e23, dayHours: 382.7, periodDays: 15.945, gravity: 1.35, temperatureK: 94, illustratedRadiusUnits: 800, color: '#d8a55a', texture: null, atmosphere: { color: '#e0b060', thickness: 0.08 }, tagline: 'A world with weather.', facts: ['The only moon with a thick atmosphere, denser than Earth’s.', 'Rain, rivers and lakes of methane.', 'Dragonfly lands there in 2034.'] }),
  B({ id: 'iapetus', name: 'Iapetus', kind: 'moon', parent: 'saturn', radiusKm: 734.5, massKg: 1.81e21, dayHours: 1903.9, periodDays: 79.33, gravity: 0.223, temperatureK: 110, illustratedRadiusUnits: 370, color: '#8f8377', texture: null, tagline: 'Two-toned.', facts: ['One hemisphere is as dark as coal, the other bright ice.', 'A ridge 13 km high runs along its equator.'] }),
  B({ id: 'miranda', name: 'Miranda', kind: 'moon', parent: 'uranus', radiusKm: 235.8, massKg: 6.4e19, dayHours: 33.9, periodDays: 1.413, gravity: 0.079, temperatureK: 60, illustratedRadiusUnits: 230, color: '#b9bcc2', texture: null, tagline: 'A jigsaw of terrains.', facts: ['Verona Rupes is a 20 km cliff, the tallest known.'] }),
  B({ id: 'ariel', name: 'Ariel', kind: 'moon', parent: 'uranus', radiusKm: 578.9, massKg: 1.25e21, dayHours: 60.5, periodDays: 2.52, gravity: 0.25, temperatureK: 60, illustratedRadiusUnits: 330, color: '#c4c6c9', texture: null, tagline: 'The brightest of Uranus.', facts: ['Crossed by long canyons and valleys.'] }),
  B({ id: 'umbriel', name: 'Umbriel', kind: 'moon', parent: 'uranus', radiusKm: 584.7, massKg: 1.28e21, dayHours: 99.5, periodDays: 4.144, gravity: 0.25, temperatureK: 61, illustratedRadiusUnits: 330, color: '#7a7c80', texture: null, tagline: 'The dark one.', facts: ['A bright ring of unknown origin sits on its crater floor.'] }),
  B({ id: 'titania', name: 'Titania', kind: 'moon', parent: 'uranus', radiusKm: 788.4, massKg: 3.4e21, dayHours: 208.9, periodDays: 8.706, gravity: 0.38, temperatureK: 60, illustratedRadiusUnits: 380, color: '#aeaba7', texture: null, tagline: 'The largest of Uranus.', facts: ['Faults and canyons hint at an expanding interior long ago.'] }),
  B({ id: 'oberon', name: 'Oberon', kind: 'moon', parent: 'uranus', radiusKm: 761.4, massKg: 3.08e21, dayHours: 323.1, periodDays: 13.463, gravity: 0.35, temperatureK: 61, illustratedRadiusUnits: 370, color: '#a09b96', texture: null, tagline: 'The outer one.', facts: ['A mountain 11 km tall stands on its limb.'] }),
  B({ id: 'proteus', name: 'Proteus', kind: 'moon', parent: 'neptune', radiusKm: 210, massKg: 4.4e19, dayHours: 26.9, periodDays: 1.122, gravity: 0.07, temperatureK: 51, illustratedRadiusUnits: 220, color: '#7d7f83', texture: null, tagline: 'Dark and lumpy.', facts: ['About as large as a body can be without becoming round.'] }),
  B({ id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', radiusKm: 1353.4, massKg: 2.14e22, dayHours: -141.0, periodDays: -5.877, gravity: 0.78, temperatureK: 38, illustratedRadiusUnits: 620, color: '#d5c9c0', texture: null, atmosphere: { color: '#e0d0c8', thickness: 0.01 }, tagline: 'A captured world.', facts: ['Orbits backwards: a captured Kuiper Belt object.', 'Nitrogen geysers erupt from a surface at 38 K.'] }),
  B({ id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', radiusKm: 606, massKg: 1.586e21, dayHours: 153.29, periodDays: 6.387, gravity: 0.29, temperatureK: 53, illustratedRadiusUnits: 400, color: '#a89c94', texture: null, tagline: 'Pluto’s partner.', facts: ['Half the diameter of Pluto; the two face each other forever.', 'A dark red polar cap of frozen organics.'] }),
];

export const BODY_BY_ID: ReadonlyMap<string, BodyInfo> = new Map(BODIES.map((b) => [b.id, b]));
export const PLANETS: BodyInfo[] = BODIES.filter((b) => b.kind === 'planet');
export const moonsOf = (parentId: string): BodyInfo[] => BODIES.filter((b) => b.kind === 'moon' && b.parent === parentId);
export const bodyInfo = (id: string): BodyInfo => {
  const b = BODY_BY_ID.get(id);
  if (!b) throw new Error(`unknown body ${id}`);
  return b;
};
