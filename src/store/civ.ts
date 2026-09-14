import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface CivState {
  chapter: number;
  playing: boolean;
  speed: number;
  night: boolean;
  chapterCount: number;
  set: (patch: Partial<Omit<CivState, 'set'>>) => void;
}

export const civStore = createStore<CivState>((set) => ({
  chapter: 0,
  playing: false,
  speed: 1,
  night: false,
  chapterCount: 18,
  set: (patch) => set(patch),
}));

export const useCiv = <T>(selector: (s: CivState) => T): T => useStore(civStore, selector);
