import type { BodyInfo } from './bodies';

/** Deep-space probes and small bodies drawn from sampled Horizons trajectories. */
export type CraftKind = 'probe' | 'comet' | 'asteroid';

export interface CraftInfo {
  id: string;
  name: string;
  kind: CraftKind;
  agency: string;
  launch: string;
  color: string;
  /** which spacecraft.json key holds the trajectory; 'l2' is computed from Earth */
  data: string | 'l2';
  tagline: string;
  facts: string[];
}

export const CRAFT: CraftInfo[] = [
  { id: 'voyager1', name: 'Voyager 1', kind: 'probe', agency: 'NASA', launch: '1977-09-05', color: '#ffd27a', data: 'voyager1', tagline: 'The farthest human-made object.', facts: ['Crossed into interstellar space in August 2012.', 'Its signal takes more than 23 hours to reach Earth.', 'Carries the Golden Record: greetings in 55 languages and 90 minutes of music.'] },
  { id: 'voyager2', name: 'Voyager 2', kind: 'probe', agency: 'NASA', launch: '1977-08-20', color: '#ffc46b', data: 'voyager2', tagline: 'The only visitor to Uranus and Neptune.', facts: ['Flew past all four giant planets between 1979 and 1989.', 'Entered interstellar space in November 2018.'] },
  { id: 'newhorizons', name: 'New Horizons', kind: 'probe', agency: 'NASA', launch: '2006-01-19', color: '#b8d4ff', data: 'newhorizons', tagline: 'Pluto, then beyond.', facts: ['Flew past Pluto on 14 July 2015 at 13.8 km/s.', 'Visited Arrokoth in the Kuiper Belt on New Year’s Day 2019, the most distant object ever explored up close.'] },
  { id: 'parker', name: 'Parker Solar Probe', kind: 'probe', agency: 'NASA', launch: '2018-08-12', color: '#ff9a6a', data: 'parker', tagline: 'Touching the Sun.', facts: ['Reached 6.1 million km from the Sun’s surface in December 2024, inside the corona.', 'The fastest human-made object: 192 km/s at perihelion.', 'Seven Venus flybys tightened its orbit step by step.'] },
  { id: 'jwst', name: 'James Webb Space Telescope', kind: 'probe', agency: 'NASA / ESA / CSA', launch: '2021-12-25', color: '#e9d8a6', data: 'l2', tagline: 'A cold eye at L2.', facts: ['Orbits the Sun-Earth L2 point, 1.5 million km beyond Earth, so its sunshield can face the Sun, Earth and Moon at once.', 'Its 6.5 m mirror sees infrared light from the first galaxies.'] },
  { id: 'halley', name: 'Halley’s Comet', kind: 'comet', agency: '', launch: '', color: '#cfe8ff', data: 'halley', tagline: 'Once every 76 years.', facts: ['Last perihelion 9 February 1986; next 28 July 2061.', 'Reached aphelion beyond Neptune in December 2023 and is now falling back toward the Sun.', 'Recorded by Chinese astronomers in 240 BC.'] },
  { id: 'apophis', name: '99942 Apophis', kind: 'asteroid', agency: '', launch: '', color: '#c9b8a8', data: 'apophis', tagline: 'A close call in 2029.', facts: ['On 13 April 2029 it passes about 32,000 km from Earth, inside the ring of geostationary satellites, visible to the naked eye.', 'About 340 m across.'] },
  { id: 'bennu', name: '101955 Bennu', kind: 'asteroid', agency: '', launch: '', color: '#a8a39c', data: 'bennu', tagline: 'Sampled and returned.', facts: ['OSIRIS-REx collected 121 g of its surface in 2020 and delivered it to Utah in September 2023.', 'A rubble pile 490 m across, spinning once every 4.3 hours.'] },
];

export const CRAFT_BY_ID: ReadonlyMap<string, CraftInfo> = new Map(CRAFT.map((c) => [c.id, c]));
export const isCraft = (id: string): boolean => CRAFT_BY_ID.has(id);

/** A craft as a body-catalog entry, so labels, picking, focus and panels reuse the planet machinery. */
export function craftAsBody(c: CraftInfo): BodyInfo {
  const radiusKm = c.kind === 'comet' ? 5.5 : c.kind === 'asteroid' ? 0.25 : 0.01;
  return {
    id: c.id,
    name: c.name,
    kind: 'craft',
    parent: 'sun',
    radiusKm,
    massKg: 0,
    dayHours: null,
    periodDays: null,
    gravity: null,
    temperatureK: null,
    illustratedRadiusUnits: 0.02,
    color: c.color,
    texture: null,
    tagline: c.tagline,
    facts: c.facts,
  };
}

export const CRAFT_BODIES: BodyInfo[] = CRAFT.map(craftAsBody);
export const CRAFT_BODY_BY_ID: ReadonlyMap<string, BodyInfo> = new Map(CRAFT_BODIES.map((b) => [b.id, b]));
/** Body or craft catalog entry. */
export function anyBodyInfo(id: string, bodies: ReadonlyMap<string, BodyInfo>): BodyInfo | undefined {
  return bodies.get(id) ?? CRAFT_BODY_BY_ID.get(id);
}
