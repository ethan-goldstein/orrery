/** satellite.js optionally loads WebAssembly SGP4 builds through package subpath imports; we use the JS path only. */
export default async function unavailable(): Promise<never> {
  throw new Error('satellite.js wasm build is not bundled');
}
