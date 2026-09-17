import { AU_KM } from './scale';
import { moonPhaseDeg, moonPositionKm, planetPositionKm } from './ephemeris';
import { upcomingEvents } from './events';

export interface AlmanacEntry {
  id: string;
  kicker: string;
  value: string;
  note: string;
  /** router path (relative to the site base) */
  href: string;
}

export interface DataStatus {
  orbit?: { count: number; snapshot: string };
  quakes?: { count: number; end: string };
}

export function phaseName(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  if (d < 22.5 || d >= 337.5) return 'New';
  if (d < 67.5) return 'Waxing crescent';
  if (d < 112.5) return 'First quarter';
  if (d < 157.5) return 'Waxing gibbous';
  if (d < 202.5) return 'Full';
  if (d < 247.5) return 'Waning gibbous';
  if (d < 292.5) return 'Last quarter';
  return 'Waning crescent';
}

/** Fraction of the disc that is lit, from the phase angle (0 = new, 180 = full). */
export function illuminatedFraction(deg: number): number {
  return (1 - Math.cos((deg * Math.PI) / 180)) / 2;
}

/** "today", "tomorrow", "in 12 days", "in 3 hours". */
export function inWords(ms: number, nowMs: number): string {
  const dt = ms - nowMs;
  if (dt < 0) return 'passed';
  const hours = dt / 3_600_000;
  if (hours < 1) return 'within the hour';
  if (hours < 24) return `in ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'tomorrow';
  if (days < 60) return `in ${days} days`;
  const months = Math.round(days / 30.44);
  return `in ${months} month${months === 1 ? '' : 's'}`;
}

const km = (n: number) => `${Math.round(n).toLocaleString('en-US')} km`;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19) + 'Z';

/** The night's numbers, computed from the same ephemerides the worlds use. */
export function almanacNow(nowMs: number, status?: DataStatus): AlmanacEntry[] {
  const out: AlmanacEntry[] = [];
  const phase = moonPhaseDeg(nowMs);
  const moon = moonPositionKm(nowMs);
  out.push({
    id: 'moon',
    kicker: 'The Moon tonight',
    value: phaseName(phase),
    note: `${Math.round(illuminatedFraction(phase) * 100)}% lit · ${km(Math.hypot(...moon))} away`,
    href: '/moon?t=now',
  });
  const earth = planetPositionKm('earth', nowMs);
  const sunKm = Math.hypot(...earth);
  out.push({
    id: 'sun',
    kicker: 'The Sun',
    value: `${(sunKm / AU_KM).toFixed(4)} AU`,
    note: `light takes ${(sunKm / 299_792.458 / 60).toFixed(2)} minutes to reach us`,
    href: '/solar?body=earth&view=planet&t=now',
  });
  let events: ReturnType<typeof upcomingEvents>;
  try {
    events = upcomingEvents(nowMs);
  } catch {
    events = [];
  }
  const eclipse = events.find((e) => e.id === 'solar-eclipse') ?? events.find((e) => e.id === 'lunar-eclipse');
  if (eclipse) {
    out.push({
      id: eclipse.id,
      kicker: eclipse.label,
      value: inWords(eclipse.ms, nowMs),
      note: eclipse.detail,
      href: `/solar?body=${eclipse.focus}&view=planet&t=${iso(eclipse.ms)}&rate=60`,
    });
  }
  const full = events.find((e) => e.id === 'full-moon');
  if (full) {
    out.push({ id: 'full-moon', kicker: 'Next full moon', value: inWords(full.ms, nowMs), note: full.detail, href: `/moon?t=${iso(full.ms)}` });
  }
  if (status?.orbit) {
    out.push({ id: 'orbit', kicker: 'Overhead', value: `${status.orbit.count.toLocaleString('en-US')} objects`, note: `tracked in orbit · CelesTrak snapshot ${status.orbit.snapshot}`, href: '/orbit' });
  }
  if (status?.quakes) {
    out.push({ id: 'quakes', kicker: 'Underfoot', value: `${status.quakes.count.toLocaleString('en-US')} quakes`, note: `magnitude 6 and up since 2000 · USGS through ${status.quakes.end}`, href: '/quakes' });
  }
  return out;
}
