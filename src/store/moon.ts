import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type MoonPreset = 'near' | 'far' | 'south' | 'terminator';

export interface MoonState {
  preset: MoonPreset;
  site: string | null;
  /** 0..1 art-directed sun longitude sweep; null = real illumination for the date */
  sunlight: number | null;
  tour: boolean;
  earthVisible: boolean;
  set: (patch: Partial<Omit<MoonState, 'set'>>) => void;
}

export const moonStore = createStore<MoonState>((set) => ({
  preset: 'near',
  site: null,
  sunlight: null,
  tour: false,
  earthVisible: true,
  set: (patch) => set(patch),
}));

export const useMoon = <T>(selector: (s: MoonState) => T): T => useStore(moonStore, selector);
