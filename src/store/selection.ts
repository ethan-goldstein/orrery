import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface SelectionState {
  /** id of the focused entity in the active experience (body, satellite, quake, chapter) */
  focus: string | null;
  hover: string | null;
  panelOpen: boolean;
  setFocus: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;
}

export const selectionStore = createStore<SelectionState>((set) => ({
  focus: null,
  hover: null,
  panelOpen: false,
  setFocus: (focus) => set({ focus, panelOpen: focus !== null }),
  setHover: (hover) => set({ hover }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
}));

export const useSelection = <T>(selector: (s: SelectionState) => T): T => useStore(selectionStore, selector);
