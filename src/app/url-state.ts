import type { TierName } from '@/engine/QualityTier';

export interface SharedUrlState {
  /** ISO timestamp, or 'now' */
  t?: string;
  rate?: number;
  labels?: boolean;
  q?: TierName;
}

export function parseSharedState(search: string): SharedUrlState {
  const p = new URLSearchParams(search);
  const out: SharedUrlState = {};
  const t = p.get('t');
  if (t) out.t = t === 'now' ? 'now' : Number.isNaN(Date.parse(t)) ? undefined : t;
  const rate = p.get('rate');
  if (rate !== null && Number.isFinite(Number(rate))) out.rate = Number(rate);
  const labels = p.get('labels');
  if (labels === '0' || labels === '1') out.labels = labels === '1';
  const q = p.get('q');
  if (q === 'low' || q === 'med' || q === 'high' || q === 'ultra') out.q = q;
  return out;
}

export function serializeSharedState(state: SharedUrlState, existing = ''): string {
  const p = new URLSearchParams(existing);
  const set = (k: string, v: string | undefined) => (v === undefined ? p.delete(k) : p.set(k, v));
  set('t', state.t);
  set('rate', state.rate === undefined ? undefined : String(state.rate));
  set('labels', state.labels === undefined ? undefined : state.labels ? '1' : '0');
  set('q', state.q);
  const s = p.toString();
  return s ? `?${s}` : '';
}

let pending: number | null = null;
/** Debounced history.replaceState so scrubbing does not spam history. */
export function writeUrl(mutate: (p: URLSearchParams) => void): void {
  if (typeof window === 'undefined') return;
  if (pending !== null) cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    pending = null;
    const p = new URLSearchParams(window.location.search);
    mutate(p);
    const s = p.toString();
    const url = `${window.location.pathname}${s ? `?${s}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  });
}
