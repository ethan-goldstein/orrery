import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Command } from '@/engine/Experience';
import type { Handoff } from '@/engine/Journey';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface ExperienceState {
  active: string | null;
  load: LoadState;
  /** short human message shown while loading or on error */
  status: string;
  cleanView: boolean;
  commands: Command[];
  /** 'veil' fades through black; 'seamless' keeps the picture while the camera carries over */
  journey: 'veil' | 'seamless' | false;
  handoff: Handoff | null;
  set: (patch: Partial<Omit<ExperienceState, 'set'>>) => void;
}

export const experienceStore = createStore<ExperienceState>((set) => ({
  active: null,
  load: 'idle',
  status: '',
  cleanView: false,
  commands: [],
  journey: false,
  handoff: null,
  set: (patch) => set(patch),
}));

export const useExperience = <T>(selector: (s: ExperienceState) => T): T => useStore(experienceStore, selector);
