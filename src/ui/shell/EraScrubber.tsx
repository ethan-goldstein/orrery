import { earthStore, useEarth } from '@/store/earth';
import { ERAS, eraAt, maToSlider, sliderToMa } from '@/experiences/earth/eras';

/** Earth's deep-time track: a non-linear slider from formation to today with the eras as stops. */
export function EraScrubber() {
  const ma = useEarth((s) => s.ma);
  const set = earthStore.getState().set;
  const sorted = [...ERAS].sort((a, b) => b.ma - a.ma);
  const current = eraAt(ma).id;
  return (
    <div className="era-scrubber" data-ui data-testid="timeline">
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(maToSlider(ma) * 1000)}
        onChange={(e) => set({ ma: sliderToMa(Number(e.target.value) / 1000), playing: false })}
        aria-label="Earth history timeline"
        className="era-range"
      />
      <ol className="era-stops">
        {sorted.map((e) => (
          <li key={e.id}>
            <button className={`era-stop${current === e.id ? ' is-active' : ''}`} onClick={() => set({ ma: e.ma, playing: false })} data-era={e.id} title={e.title}>
              {e.fact === 'Now' ? 'Today' : `${e.fact} ${e.factLabel.startsWith('billion') ? 'Ga' : 'Ma'}`}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
