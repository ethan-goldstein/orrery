export function Fallback() {
  return (
    <main className="fallback" data-testid="webgl-fallback">
      <p className="kicker">Orrery</p>
      <h1 className="text-3xl font-semibold mt-2">This browser cannot draw the sky.</h1>
      <p className="mt-4 text-fog-2">
        Orrery renders Earth, the Moon and the Solar System with WebGL 2, which is switched off or unsupported here.
        Try a current version of Chrome, Firefox, Safari or Edge, or enable hardware acceleration.
      </p>
      <p className="mt-6 text-sm text-fog-2">
        Sun, eight planets, hundreds of moons, 4.54 billion years of Earth, every M6+ earthquake since 2000,
        the ocean's currents and the human story are all waiting on the other side.
      </p>
    </main>
  );
}
