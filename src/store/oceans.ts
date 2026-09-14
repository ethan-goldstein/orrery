import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type OceanPreset = 'planet' | 'gulf' | 'pacific' | 'southern';

export interface OceanState {
  preset: OceanPreset;
  playing: boolean;
  /** 0..1 fraction of particles revealed */
  reveal: number;
  speed: number;
  particleCount: number;
  set: (patch: Partial<Omit<OceanState, 'set'>>) => void;
}

export const oceanStore = createStore<OceanState>((set) => ({
  preset: 'planet',
  playing: true,
  reveal: 0.8,
  speed: 1,
  particleCount: 0,
  set: (patch) => set(patch),
}));

export const useOceans = <T>(selector: (s: OceanState) => T): T => useStore(oceanStore, selector);
