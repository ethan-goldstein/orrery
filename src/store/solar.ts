import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type SolarView = 'system' | 'planet' | 'moons' | 'inner' | 'compare';

export interface SolarTelemetry {
  /** distance from focus to its parent, km */
  parentDistanceKm: number;
  /** distance from focus to the Sun, km */
  sunDistanceKm: number;
  /** camera distance to focus surface, km */
  cameraAltitudeKm: number;
  /** moons currently computed */
  moonCount: number;
  /** Earth-Moon phase in degrees when relevant */
  moonPhaseDeg: number;
  /** heliocentric speed of the focus, km/s (crafts) */
  speedKmS: number;
  earthDistanceKm: number;
}

export interface SolarState {
  view: SolarView;
  focus: string;
  trueScale: boolean;
  paths: boolean;
  trails: boolean;
  tour: boolean;
  /** show spacecraft, comets and asteroids */
  crafts: boolean;
  /** engine-owned animated 0..1 */
  scaleMix: number;
  telemetry: SolarTelemetry;
  setView: (v: SolarView) => void;
  setFocus: (id: string, view?: SolarView) => void;
  setTrueScale: (v: boolean) => void;
  setPaths: (v: boolean) => void;
  setTrails: (v: boolean) => void;
  setTour: (v: boolean) => void;
  setCrafts: (v: boolean) => void;
}

export const solarStore = createStore<SolarState>((set) => ({
  view: 'system',
  focus: 'sun',
  trueScale: false,
  paths: true,
  trails: true,
  tour: false,
  scaleMix: 0,
  crafts: true,
  telemetry: { parentDistanceKm: 0, sunDistanceKm: 0, cameraAltitudeKm: 0, moonCount: 0, moonPhaseDeg: 0, speedKmS: 0, earthDistanceKm: 0 },
  setView: (view) => set({ view }),
  setFocus: (focus, view) => set((s) => ({ focus, view: view ?? (s.view === 'system' || s.view === 'inner' ? 'planet' : s.view), tour: false })),
  setTrueScale: (trueScale) => set({ trueScale }),
  setPaths: (paths) => set({ paths }),
  setTrails: (trails) => set({ trails }),
  setTour: (tour) => set({ tour }),
  setCrafts: (crafts) => set({ crafts }),
}));

export const useSolar = <T>(selector: (s: SolarState) => T): T => useStore(solarStore, selector);
