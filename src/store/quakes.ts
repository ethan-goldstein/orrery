import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type QuakePreset = 'all' | 'pacific' | 'japan2011' | 'deep';

export interface QuakeState {
  preset: QuakePreset;
  /** show events up to this unix time (seconds) */
  throughSeconds: number;
  playing: boolean;
  selected: string | null;
  visibleCount: number;
  totalCount: number;
  range: { start: number; end: number };
  selectedInfo: { id: string; place: string; mag: number; depthKm: number; time: number; lat: number; lon: number } | null;
  set: (patch: Partial<Omit<QuakeState, 'set'>>) => void;
}

export const quakeStore = createStore<QuakeState>((set) => ({
  preset: 'all',
  throughSeconds: Math.floor(Date.now() / 1000),
  playing: false,
  selected: null,
  visibleCount: 0,
  totalCount: 0,
  range: { start: 946_684_800, end: Math.floor(Date.now() / 1000) },
  selectedInfo: null,
  set: (patch) => set(patch),
}));

export const useQuakes = <T>(selector: (s: QuakeState) => T): T => useStore(quakeStore, selector);
