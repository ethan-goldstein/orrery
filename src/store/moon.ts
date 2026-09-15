import { createWorldStore, makeUseWorld } from './world';

export type MoonPreset = string;
export const moonStore = createWorldStore('near');
export const useMoon = makeUseWorld(moonStore);
