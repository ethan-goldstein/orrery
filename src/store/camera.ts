import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface CameraRequest {
  kind: 'in' | 'out' | 'reset' | 'nudge';
  /** nonce so repeated clicks re-fire */
  n: number;
  dx?: number;
  dy?: number;
}

export interface CameraState {
  /** camera distance in scene units (from the focused body's centre when there is one) */
  distance: number;
  min: number;
  max: number;
  /** human readout, e.g. "12,430 km up" */
  readout: string | null;
  request: CameraRequest | null;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  nudge: (dx: number, dy: number) => void;
  publish: (p: Partial<Pick<CameraState, 'distance' | 'min' | 'max' | 'readout'>>) => void;
}

let nonce = 0;

export const cameraStore = createStore<CameraState>((set) => ({
  distance: 0,
  min: 0,
  max: 0,
  readout: null,
  request: null,
  zoomIn: () => set({ request: { kind: 'in', n: ++nonce } }),
  zoomOut: () => set({ request: { kind: 'out', n: ++nonce } }),
  reset: () => set({ request: { kind: 'reset', n: ++nonce } }),
  nudge: (dx, dy) => set({ request: { kind: 'nudge', n: ++nonce, dx, dy } }),
  publish: (p) => set(p),
}));

export const useCamera = <T>(selector: (s: CameraState) => T): T => useStore(cameraStore, selector);
