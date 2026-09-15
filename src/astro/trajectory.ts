import type { Km3 } from './ephemeris';

/**
 * A sampled heliocentric trajectory (from Horizons) interpolated with cubic
 * Hermite splines using the sampled velocities. Rows: [jd, x, y, z, vx, vy, vz]
 * in the ecliptic frame; output is scene-frame km ((x, z, -y)).
 */
export class Trajectory {
  private readonly jd: Float64Array;
  private readonly pos: Float64Array; // scene km, 3 per row
  private readonly vel: Float64Array; // scene km/s, 3 per row
  readonly count: number;

  constructor(rows: number[][]) {
    this.count = rows.length;
    this.jd = new Float64Array(this.count);
    this.pos = new Float64Array(this.count * 3);
    this.vel = new Float64Array(this.count * 3);
    rows.forEach((r, i) => {
      this.jd[i] = r[0]!;
      this.pos[i * 3] = r[1]!;
      this.pos[i * 3 + 1] = r[3]!;
      this.pos[i * 3 + 2] = -r[2]!;
      this.vel[i * 3] = r[4] ?? 0;
      this.vel[i * 3 + 1] = r[6] ?? 0;
      this.vel[i * 3 + 2] = -(r[5] ?? 0);
    });
  }

  get startMs(): number {
    return jdToMs(this.jd[0]!);
  }

  get endMs(): number {
    return jdToMs(this.jd[this.count - 1]!);
  }

  /** Index of the last sample at or before jd, or -1 before the first sample. */
  private indexAt(jd: number): number {
    let lo = 0;
    let hi = this.count - 1;
    if (jd < this.jd[0]!) return -1;
    if (jd >= this.jd[hi]!) return hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.jd[mid]! <= jd) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /** Position and velocity at a time; null before launch, clamped after the last sample. */
  at(ms: number): { r: Km3; v: Km3 } | null {
    const jd = msToJd(ms);
    const i = this.indexAt(jd);
    if (i < 0) return null;
    if (i >= this.count - 1) return { r: this.row(this.count - 1), v: this.vrow(this.count - 1) };
    const j = i + 1;
    const h = (this.jd[j]! - this.jd[i]!) * 86400; // seconds
    const t = ((jd - this.jd[i]!) * 86400) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const d00 = 6 * t2 - 6 * t;
    const d10 = 3 * t2 - 4 * t + 1;
    const d01 = -6 * t2 + 6 * t;
    const d11 = 3 * t2 - 2 * t;
    const r: Km3 = [0, 0, 0];
    const v: Km3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const p0 = this.pos[i * 3 + k]!;
      const p1 = this.pos[j * 3 + k]!;
      const m0 = this.vel[i * 3 + k]! * h;
      const m1 = this.vel[j * 3 + k]! * h;
      r[k] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
      v[k] = (d00 * p0 + d10 * m0 + d01 * p1 + d11 * m1) / h;
    }
    return { r, v };
  }

  /** Sampled positions from launch up to `untilMs` (inclusive of the interpolated tip). */
  slice(untilMs: number, maxPoints = 4000): Km3[] {
    const jd = msToJd(untilMs);
    const i = this.indexAt(jd);
    if (i < 0) return [];
    const n = Math.min(i + 1, this.count);
    const stride = Math.max(1, Math.ceil(n / maxPoints));
    const out: Km3[] = [];
    for (let k = 0; k < n; k += stride) out.push(this.row(k));
    const tip = this.at(untilMs);
    if (tip) out.push(tip.r);
    return out;
  }

  private row(i: number): Km3 {
    return [this.pos[i * 3]!, this.pos[i * 3 + 1]!, this.pos[i * 3 + 2]!];
  }

  private vrow(i: number): Km3 {
    return [this.vel[i * 3]!, this.vel[i * 3 + 1]!, this.vel[i * 3 + 2]!];
  }
}

export const msToJd = (ms: number): number => ms / 86_400_000 + 2440587.5;
export const jdToMs = (jd: number): number => (jd - 2440587.5) * 86_400_000;
