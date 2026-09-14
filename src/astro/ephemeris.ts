import { Body, GeoMoon, HelioState, HelioVector, JupiterMoons, MoonPhase } from 'astronomy-engine';
import { eqjToScene } from './frames';
import { AU_KM } from './scale';
import { elementsFromState, propagate, type Elements } from './kepler';
import { assetUrl } from '@/engine/Assets';

export type Km3 = [number, number, number];

const PLANET_BODY: Record<string, Body> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

const AU_PER_DAY_TO_KM_PER_S = AU_KM / 86400;

/** Heliocentric position of a planet in scene-frame km. */
export function planetPositionKm(id: string, ms: number): Km3 {
  const body = PLANET_BODY[id];
  if (!body) throw new Error(`unknown planet ${id}`);
  const v = HelioVector(body, new Date(ms));
  const s = eqjToScene([v.x, v.y, v.z]);
  return [s[0] * AU_KM, s[1] * AU_KM, s[2] * AU_KM];
}

/** Heliocentric state (km, km/s) in scene frame. */
export function planetStateKm(id: string, ms: number): { r: Km3; v: Km3 } {
  const body = PLANET_BODY[id];
  if (!body) throw new Error(`unknown planet ${id}`);
  const st = HelioState(body, new Date(ms));
  const r = eqjToScene([st.x, st.y, st.z]);
  const v = eqjToScene([st.vx, st.vy, st.vz]);
  return {
    r: [r[0] * AU_KM, r[1] * AU_KM, r[2] * AU_KM],
    v: [v[0] * AU_PER_DAY_TO_KM_PER_S, v[1] * AU_PER_DAY_TO_KM_PER_S, v[2] * AU_PER_DAY_TO_KM_PER_S],
  };
}

/** Geocentric Moon position, scene-frame km. */
export function moonPositionKm(ms: number): Km3 {
  const v = GeoMoon(new Date(ms));
  const s = eqjToScene([v.x, v.y, v.z]);
  return [s[0] * AU_KM, s[1] * AU_KM, s[2] * AU_KM];
}

const GALILEAN = ['io', 'europa', 'ganymede', 'callisto'] as const;
let galileanCache: { ms: number; pos: Record<string, Km3> } | null = null;

/** Jovicentric Galilean moon positions, scene-frame km. */
export function galileanPositionKm(id: (typeof GALILEAN)[number], ms: number): Km3 {
  if (!galileanCache || galileanCache.ms !== ms) {
    const info = JupiterMoons(new Date(ms));
    const pos: Record<string, Km3> = {};
    for (const [name, st] of [
      ['io', info.io],
      ['europa', info.europa],
      ['ganymede', info.ganymede],
      ['callisto', info.callisto],
    ] as const) {
      const s = eqjToScene([st.x, st.y, st.z]);
      pos[name] = [s[0] * AU_KM, s[1] * AU_KM, s[2] * AU_KM];
    }
    galileanCache = { ms, pos };
  }
  return galileanCache.pos[id]!;
}

export const isGalilean = (id: string): id is (typeof GALILEAN)[number] => (GALILEAN as readonly string[]).includes(id);

export function moonPhaseDeg(ms: number): number {
  return MoonPhase(new Date(ms));
}

/* ---------- Kepler-propagated moons seeded from Horizons ---------- */

interface MoonsFile {
  epoch: string;
  moons: Record<string, { parent: string; gm: number; epochMs: number; state: [number, number, number, number, number, number] }>;
}

const keplerMoons = new Map<string, { parent: string; el: Elements }>();
let moonsLoaded: Promise<void> | null = null;

export function loadKeplerMoons(signal?: AbortSignal): Promise<void> {
  moonsLoaded ??= (async () => {
    const res = await fetch(assetUrl('data/solar/moons.json'), { signal });
    if (!res.ok) throw new Error(`moons.json ${res.status}`);
    const file = (await res.json()) as MoonsFile;
    seedKeplerMoons(file);
  })();
  return moonsLoaded;
}

/** Exposed for tests: seed from an in-memory file. */
export function seedKeplerMoons(file: MoonsFile): void {
  for (const [id, m] of Object.entries(file.moons)) {
    const [x, y, z, vx, vy, vz] = m.state;
    // Horizons ecliptic (x, y, z) -> scene (x, z, -y); same for velocity
    const r: Km3 = [x, z, -y];
    const v: Km3 = [vx, vz, -vy];
    keplerMoons.set(id, { parent: m.parent, el: elementsFromState(r, v, m.gm, m.epochMs) });
  }
}

/** Parent-centred position of a Kepler moon, scene-frame km. */
export function keplerMoonPositionKm(id: string, ms: number): Km3 | null {
  const m = keplerMoons.get(id);
  if (!m) return null;
  return propagate(m.el, ms).r;
}

export function keplerMoonElements(id: string): Elements | null {
  return keplerMoons.get(id)?.el ?? null;
}

export function hasKeplerMoon(id: string): boolean {
  return keplerMoons.has(id);
}
