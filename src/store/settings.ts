import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { TierName } from '@/engine/QualityTier';

export interface SettingsState {
  quality: TierName | 'auto';
  probedQuality: TierName;
  labels: boolean;
  grain: boolean;
  reducedMotion: boolean;
  units: 'metric' | 'imperial';
  setQuality: (q: TierName | 'auto') => void;
  setProbedQuality: (q: TierName) => void;
  setLabels: (v: boolean) => void;
  setGrain: (v: boolean) => void;
  setUnits: (u: 'metric' | 'imperial') => void;
}

const KEY = 'orrery.settings.v1';

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<SettingsState>) : {};
  } catch {
    return {};
  }
}

function persist(s: SettingsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ quality: s.quality, labels: s.labels, grain: s.grain, units: s.units }));
  } catch {
    /* private mode */
  }
}

const saved = typeof localStorage !== 'undefined' ? load() : {};

export const settingsStore = createStore<SettingsState>((set, get) => ({
  quality: saved.quality ?? 'auto',
  probedQuality: 'med',
  labels: saved.labels ?? true,
  grain: saved.grain ?? false,
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  units: saved.units ?? 'metric',
  setQuality: (quality) => {
    set({ quality });
    persist(get());
  },
  setProbedQuality: (probedQuality) => set({ probedQuality }),
  setLabels: (labels) => {
    set({ labels });
    persist(get());
  },
  setGrain: (grain) => {
    set({ grain });
    persist(get());
  },
  setUnits: (units) => {
    set({ units });
    persist(get());
  },
}));

export const useSettings = <T>(selector: (s: SettingsState) => T): T => useStore(settingsStore, selector);
