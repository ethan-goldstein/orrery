import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface ShellState {
  /** the facts drawer on the right of every world */
  drawerOpen: boolean;
  setDrawer: (open: boolean) => void;
  toggleDrawer: () => void;
}

const KEY = 'orrery:drawer';

const initial = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== 'closed';
  } catch {
    return true;
  }
};

export const shellStore = createStore<ShellState>((set, get) => ({
  drawerOpen: initial(),
  setDrawer: (open) => {
    try {
      localStorage.setItem(KEY, open ? 'open' : 'closed');
    } catch {
      /* private mode */
    }
    set({ drawerOpen: open });
  },
  toggleDrawer: () => get().setDrawer(!get().drawerOpen),
}));

export const useShell = <T>(selector: (s: ShellState) => T): T => useStore(shellStore, selector);
