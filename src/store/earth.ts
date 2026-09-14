import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type LightMode = 'natural' | 'night' | 'blue';

export interface EarthState {
  /** millions of years ago, 0 = today */
  ma: number;
  playing: boolean;
  speed: number;
  light: LightMode;
  /** 0..24 art-directed sun hour; null = real sun for the current date */
  sunHour: number | null;
  clouds: boolean;
  rotate: boolean;
  compare: boolean;
  /** which frames are resident, for diagnostics */
  framesLoaded: number;
  set: (patch: Partial<Omit<EarthState, 'set'>>) => void;
}

export const earthStore = createStore<EarthState>((set) => ({
  ma: 0,
  playing: false,
  speed: 1,
  light: 'natural',
  sunHour: null,
  clouds: true,
  rotate: true,
  compare: false,
  framesLoaded: 0,
  set: (patch) => set(patch),
}));

export const useEarth = <T>(selector: (s: EarthState) => T): T => useStore(earthStore, selector);
