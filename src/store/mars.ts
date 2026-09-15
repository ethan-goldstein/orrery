import { createWorldStore, makeUseWorld } from './world';

export const marsStore = createWorldStore('global');
export const useMars = makeUseWorld(marsStore);
