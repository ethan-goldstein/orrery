/// <reference lib="webworker" />
import { gstime, json2satrec, propagate, type SatRec } from 'satellite.js';

/**
 * Propagates every tracked object with SGP4 off the main thread. Positions
 * and velocities come back in a transferable Float32Array in the scene
 * frame (ECI TEME with +Y = north): scene = (x, z, -y), units of 1000 km.
 */
interface Obj { id: number; e: string; mm: number; ec: number; in: number; ra: number; ap: number; ma: number; bs: number; md: number; rev: number; els: number; n: string }

let recs: SatRec[] = [];
let ids: number[] = [];

self.onmessage = (ev: MessageEvent<{ type: 'load'; objects: Obj[] } | { type: 'propagate'; ms: number; buffer?: Float32Array }>) => {
  const msg = ev.data;
  if (msg.type === 'load') {
    recs = [];
    ids = [];
    let bad = 0;
    for (const o of msg.objects) {
      try {
        const rec = json2satrec({
          OBJECT_NAME: o.n,
          OBJECT_ID: '',
          EPOCH: o.e,
          MEAN_MOTION: o.mm,
          ECCENTRICITY: o.ec,
          INCLINATION: o.in,
          RA_OF_ASC_NODE: o.ra,
          ARG_OF_PERICENTER: o.ap,
          MEAN_ANOMALY: o.ma,
          EPHEMERIS_TYPE: 0,
          CLASSIFICATION_TYPE: 'U',
          NORAD_CAT_ID: o.id,
          ELEMENT_SET_NO: o.els,
          REV_AT_EPOCH: o.rev,
          BSTAR: o.bs,
          MEAN_MOTION_DOT: o.md,
          MEAN_MOTION_DDOT: 0,
        });
        if (rec.error) {
          bad++;
          continue;
        }
        recs.push(rec);
        ids.push(o.id);
      } catch {
        bad++;
      }
    }
    self.postMessage({ type: 'loaded', count: recs.length, bad, ids });
    return;
  }
  if (msg.type === 'propagate') {
    const out = msg.buffer && msg.buffer.length === recs.length * 6 ? msg.buffer : new Float32Array(recs.length * 6);
    const date = new Date(msg.ms);
    const k = 1e-3; // km -> scene units
    for (let i = 0; i < recs.length; i++) {
      const pv = propagate(recs[i]!, date);
      const p = pv?.position;
      const v = pv?.velocity;
      const o = i * 6;
      if (!p || !v || typeof p === 'boolean' || typeof v === 'boolean' || !Number.isFinite(p.x)) {
        out[o] = out[o + 1] = out[o + 2] = NaN;
        out[o + 3] = out[o + 4] = out[o + 5] = 0;
        continue;
      }
      out[o] = p.x * k;
      out[o + 1] = p.z * k;
      out[o + 2] = -p.y * k;
      out[o + 3] = v.x * k;
      out[o + 4] = v.z * k;
      out[o + 5] = -v.y * k;
    }
    self.postMessage({ type: 'positions', ms: msg.ms, gmst: gstime(date), buffer: out }, [out.buffer]);
  }
};
