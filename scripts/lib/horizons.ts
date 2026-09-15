/** Shared JPL Horizons vector query (ecliptic J2000, km, km/s, geometric). */
export type State = [number, number, number, number, number, number];

export async function horizonsVectors(command: string, center: string, start: string, stop: string, step: string): Promise<{ jd: number; state: State }[]> {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${center}'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    REF_PLANE: "'ECLIPTIC'",
    VEC_TABLE: "'2'",
    VEC_CORR: "'NONE'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
  });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
  let lastText = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'orrery-data-pipeline (https://github.com/ethan-goldstein/orrery)' } });
    const text = await res.text();
    lastText = text;
    const block = text.split('$$SOE')[1]?.split('$$EOE')[0];
    if (res.ok && block) {
      return block
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const f = line.split(',').map((s) => s.trim());
          return { jd: Number(f[0]), state: f.slice(2, 8).map(Number) as State };
        });
    }
    if (/No ephemeris for target|out of bounds|not available/i.test(text)) break; // do not retry a hard limit
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`Horizons failed for ${command}@${center} ${start}..${stop}: ${lastText.split('\n').find((l) => /error|No ephemeris|out of bounds|not available/i.test(l)) ?? lastText.slice(0, 120)}`);
}
