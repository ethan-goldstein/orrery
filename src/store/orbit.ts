import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type OrbitGroup = 'leo' | 'meo' | 'geo' | 'all';

export interface OrbitState {
  group: OrbitGroup;
  debris: boolean;
  paths: boolean;
  /** NORAD id of the selected object */
  selected: number | null;
  follow: boolean;
  /** show only objects launched up to this year */
  year: number;
  playingTimeline: boolean;
  visibleCount: number;
  totalCount: number;
  /** CelesTrak snapshot date of the loaded catalogue */
  snapshot: string;
  selectedInfo: { name: string; id: number; type: string; owner: string; launch: number; altKm: number; speedKmS: number; periodMin: number; incl: number } | null;
  set: (patch: Partial<Omit<OrbitState, 'set'>>) => void;
}

export const orbitStore = createStore<OrbitState>((set) => ({
  group: 'leo',
  debris: false,
  paths: true,
  selected: null,
  follow: false,
  year: new Date().getUTCFullYear(),
  playingTimeline: false,
  visibleCount: 0,
  totalCount: 0,
  snapshot: '',
  selectedInfo: null,
  set: (patch) => set(patch),
}));

export const useOrbit = <T>(selector: (s: OrbitState) => T): T => useStore(orbitStore, selector);
