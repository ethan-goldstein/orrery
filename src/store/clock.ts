import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { clampMs, type ClockState } from '@/astro/time';

export interface ClockActions {
  setEpoch: (ms: number) => void;
  setRate: (rate: number) => void;
  setPlaying: (playing: boolean) => void;
  toggle: () => void;
  setFollowNow: (on: boolean) => void;
}

export const clockStore = createStore<ClockState & ClockActions>((set, get) => ({
  epochMs: Date.now(),
  rate: 1,
  playing: true,
  followNow: true,
  setEpoch: (ms) => set({ epochMs: clampMs(ms), followNow: false }),
  setRate: (rate) => set({ rate, followNow: rate === 1 ? get().followNow : false }),
  setPlaying: (playing) => set({ playing }),
  toggle: () => set({ playing: !get().playing }),
  setFollowNow: (on) => set(on ? { followNow: true, rate: 1, playing: true, epochMs: Date.now() } : { followNow: false }),
}));

export const useClock = <T>(selector: (s: ClockState & ClockActions) => T): T => useStore(clockStore, selector);
