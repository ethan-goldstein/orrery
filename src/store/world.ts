import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

/** State shared by every single-world page (Moon, Mars, ...). */
export interface WorldState {
  preset: string;
  site: string | null;
  /** 0..1 art-directed sun sweep; null = real illumination for the date */
  sunlight: number | null;
  tour: boolean;
  /** show companions (Earth in the Moon's sky, Phobos and Deimos over Mars) */
  companions: boolean;
  /** world-specific 0..1 knob (Mars: dust in the air) */
  dust: number;
  set: (patch: Partial<Omit<WorldState, 'set'>>) => void;
}

export type WorldStore = StoreApi<WorldState>;

export function createWorldStore(defaultPreset: string): WorldStore {
  return createStore<WorldState>((set) => ({
    preset: defaultPreset,
    site: null,
    sunlight: null,
    tour: false,
    companions: true,
    dust: 0.15,
    set: (patch) => set(patch),
  }));
}

export const makeUseWorld =
  (store: WorldStore) =>
  <T,>(selector: (s: WorldState) => T): T =>
    useStore(store, selector);
