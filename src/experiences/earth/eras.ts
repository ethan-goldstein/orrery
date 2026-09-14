/**
 * The ten stops on the deep-time timeline. Ages in millions of years ago.
 * `kind` is the honesty label shown on screen: the first four eras predate
 * any plate reconstruction and are art-directed; 540 Ma onward is drawn
 * from the PALEOMAP PaleoDEMs (Scotese & Wright 2018, CC BY 4.0); today is
 * photographic.
 */
export type EraKind = 'artistic' | 'reconstruction' | 'photographic';

export interface Era {
  id: string;
  ma: number;
  title: string;
  period: string;
  headline: string;
  story: string;
  fact: string;
  factLabel: string;
  kind: EraKind;
  /** camera target */
  lat: number;
  lon: number;
  /** art-direction knobs 0..1 */
  heat: number;
  cloud: number;
  ice: number;
  seaLevel: number;
  source: { name: string; url: string };
}

export const ERA_KIND_LABEL: Record<EraKind, string> = {
  artistic: 'Artistic interpretation',
  reconstruction: 'Paleogeographic reconstruction',
  photographic: 'Photographic Earth',
};

export const ERAS: Era[] = [
  { id: 'formation', ma: 4540, title: 'Formation', period: 'Hadean', headline: 'Born in fire.', story: 'A molten world, still gathering itself out of the debris of the young Sun. No crust, no ocean, a sky of rock vapor.', fact: '4.54', factLabel: 'billion years ago', kind: 'artistic', lat: 10, lon: 20, heat: 1, cloud: 0.1, ice: 0, seaLevel: -12000, source: { name: 'Bouvier & Wadhwa 2010, age of the Solar System', url: 'https://www.nature.com/articles/ngeo941' } },
  { id: 'oceans', ma: 4300, title: 'First oceans', period: 'Hadean', headline: 'The first rain.', story: 'The crust cooled enough for water to stay liquid. Zircon crystals from this time carry the chemical fingerprint of oceans.', fact: '4.3', factLabel: 'billion years ago', kind: 'artistic', lat: 0, lon: -40, heat: 0.55, cloud: 0.7, ice: 0, seaLevel: -1500, source: { name: 'Wilde et al. 2001, Jack Hills zircons', url: 'https://www.nature.com/articles/35051550' } },
  { id: 'oxygen', ma: 2400, title: 'Oxygen rises', period: 'Paleoproterozoic', headline: 'The air turns.', story: 'Cyanobacteria had been exhaling oxygen for hundreds of millions of years. Now it finally overwhelmed the rocks and filled the sky.', fact: '2.4', factLabel: 'billion years ago', kind: 'artistic', lat: 15, lon: 60, heat: 0.05, cloud: 0.45, ice: 0.15, seaLevel: 200, source: { name: 'Lyons et al. 2014, the Great Oxidation Event', url: 'https://www.nature.com/articles/nature13068' } },
  { id: 'snowball', ma: 650, title: 'Snowball Earth', period: 'Cryogenian', headline: 'Ice to the equator.', story: 'Glaciers reached the tropics. For millions of years the planet may have been white from pole to pole, alive only beneath the ice.', fact: '650', factLabel: 'million years ago', kind: 'artistic', lat: 5, lon: 0, heat: 0, cloud: 0.3, ice: 1, seaLevel: -120, source: { name: 'Hoffman et al. 2017, Snowball Earth climate dynamics', url: 'https://www.science.org/doi/10.1126/sciadv.1600983' } },
  { id: 'cambrian', ma: 540, title: 'Ancient seas', period: 'Early Cambrian', headline: 'Life gets eyes.', story: 'Shallow seas covered the continents’ edges. In a few million years animals acquired shells, eyes and appetites.', fact: '540', factLabel: 'million years ago', kind: 'reconstruction', lat: -20, lon: 30, heat: 0, cloud: 0.45, ice: 0.05, seaLevel: 60, source: { name: 'Scotese & Wright 2018, PALEOMAP PaleoDEMs', url: 'https://zenodo.org/records/5460860' } },
  { id: 'devonian', ma: 400, title: 'Worlds converge', period: 'Early Devonian', headline: 'Forests arrive.', story: 'Plants climbed onto land and grew tall. Fish were about to follow them. The continents were sliding toward each other.', fact: '400', factLabel: 'million years ago', kind: 'reconstruction', lat: 0, lon: 0, heat: 0, cloud: 0.5, ice: 0.05, seaLevel: 80, source: { name: 'Scotese & Wright 2018, PALEOMAP PaleoDEMs', url: 'https://zenodo.org/records/5460860' } },
  { id: 'pangaea', ma: 300, title: 'Pangaea', period: 'Late Carboniferous', headline: 'One land.', story: 'Every continent locked into a single supercontinent wrapped around the equator, with one ocean on the other side of the world.', fact: '300', factLabel: 'million years ago', kind: 'reconstruction', lat: 10, lon: -20, heat: 0, cloud: 0.45, ice: 0.25, seaLevel: 20, source: { name: 'Scotese & Wright 2018, PALEOMAP PaleoDEMs', url: 'https://zenodo.org/records/5460860' } },
  { id: 'triassic', ma: 200, title: 'The great divide', period: 'End Triassic', headline: 'Pangaea cracks.', story: 'Rifts opened down the middle of the supercontinent; the Atlantic began as a valley of lakes. Dinosaurs inherited a changed world.', fact: '200', factLabel: 'million years ago', kind: 'reconstruction', lat: 20, lon: -30, heat: 0, cloud: 0.4, ice: 0, seaLevel: 40, source: { name: 'Scotese & Wright 2018, PALEOMAP PaleoDEMs', url: 'https://zenodo.org/records/5460860' } },
  { id: 'cretaceous', ma: 100, title: 'Oceans between', period: 'Cretaceous', headline: 'A greenhouse world.', story: 'Sea levels stood 200 m higher than today. Inland seas split North America and flooded Europe. No ice anywhere.', fact: '100', factLabel: 'million years ago', kind: 'reconstruction', lat: 30, lon: -60, heat: 0, cloud: 0.5, ice: 0, seaLevel: 180, source: { name: 'Scotese & Wright 2018, PALEOMAP PaleoDEMs', url: 'https://zenodo.org/records/5460860' } },
  { id: 'present', ma: 0, title: 'Our world', period: 'Today', headline: 'Home.', story: 'Familiar coastlines, at last. The same forces are still at work: Africa is splitting, the Atlantic widens a few centimetres a year.', fact: 'Now', factLabel: 'the present day', kind: 'photographic', lat: 20, lon: 10, heat: 0, cloud: 1, ice: 0.1, seaLevel: 0, source: { name: 'NASA Blue Marble via Solar System Scope', url: 'https://www.solarsystemscope.com/textures/' } },
];

export const ERA_BY_ID: ReadonlyMap<string, Era> = new Map(ERAS.map((e) => [e.id, e]));

/** Non-linear timeline: each era gets equal width regardless of duration. */
export function maToSlider(ma: number): number {
  const eras = [...ERAS].sort((a, b) => b.ma - a.ma);
  for (let i = 0; i < eras.length - 1; i++) {
    const a = eras[i]!.ma;
    const b = eras[i + 1]!.ma;
    if (ma <= a && ma >= b) return (i + (a - ma) / (a - b)) / (eras.length - 1);
  }
  return ma > eras[0]!.ma ? 0 : 1;
}

export function sliderToMa(t: number): number {
  const eras = [...ERAS].sort((a, b) => b.ma - a.ma);
  const x = Math.min(1, Math.max(0, t)) * (eras.length - 1);
  const i = Math.min(eras.length - 2, Math.floor(x));
  const f = x - i;
  return eras[i]!.ma + (eras[i + 1]!.ma - eras[i]!.ma) * f;
}

export function eraAt(ma: number): Era {
  let best = ERAS[0]!;
  for (const e of ERAS) if (Math.abs(e.ma - ma) < Math.abs(best.ma - ma)) best = e;
  return best;
}

export function formatAge(ma: number): string {
  if (ma < 0.5) return 'Now';
  if (ma >= 1000) return `${(ma / 1000).toFixed(2)} billion years ago`;
  return `${Math.round(ma)} million years ago`;
}
