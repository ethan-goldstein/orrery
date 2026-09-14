import { SearchGlobalSolarEclipse, SearchLunarEclipse, SearchMoonPhase, Seasons } from 'astronomy-engine';

export interface AstroEvent {
  id: string;
  label: string;
  ms: number;
  /** what to look at */
  focus: 'earth' | 'moon' | 'sun';
  detail: string;
}

/** Upcoming moments worth jumping to, computed from the current simulation time. */
export function upcomingEvents(fromMs: number): AstroEvent[] {
  const from = new Date(fromMs);
  const out: AstroEvent[] = [];
  try {
    const se = SearchGlobalSolarEclipse(from);
    out.push({ id: 'solar-eclipse', label: 'Next solar eclipse', ms: se.peak.date.getTime(), focus: 'earth', detail: `${se.kind} solar eclipse, peak ${se.peak.date.toISOString().slice(0, 16).replace('T', ' ')} UTC` });
  } catch {
    /* outside the reliable range */
  }
  try {
    const le = SearchLunarEclipse(from);
    out.push({ id: 'lunar-eclipse', label: 'Next lunar eclipse', ms: le.peak.date.getTime(), focus: 'moon', detail: `${le.kind} lunar eclipse, peak ${le.peak.date.toISOString().slice(0, 16).replace('T', ' ')} UTC` });
  } catch {
    /* ignore */
  }
  const full = SearchMoonPhase(180, from, 40);
  if (full) out.push({ id: 'full-moon', label: 'Next full moon', ms: full.date.getTime(), focus: 'moon', detail: `Full moon ${full.date.toISOString().slice(0, 10)}` });
  const year = from.getUTCFullYear();
  const s = Seasons(year);
  const next = [s.mar_equinox, s.jun_solstice, s.sep_equinox, s.dec_solstice].map((t, i) => ({ t: t.date.getTime(), name: ['March equinox', 'June solstice', 'September equinox', 'December solstice'][i]! })).find((x) => x.t > fromMs) ?? { t: Seasons(year + 1).mar_equinox.date.getTime(), name: 'March equinox' };
  out.push({ id: 'season', label: `Next ${next.name.split(' ')[1]}`, ms: next.t, focus: 'earth', detail: `${next.name} ${new Date(next.t).toISOString().slice(0, 10)}` });
  return out;
}
