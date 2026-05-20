import { PB } from '@/tokens/pb';

export type RegionStatus = 'installed' | 'available' | { downloading: number };

/**
 * Static region descriptor. The display strings (`name`, `sub`,
 * `tagline`, family labels, why-blurbs, model notes) all live in the
 * translation packs under `regions.list.<id>` and `regions.detail.<id>`.
 * Only the language-invariant bits — id, emoji, size, color — stay here.
 */
export type Region = {
  id: string;
  emoji: string;
  size: number;
  color: string;
};

export const REGIONS: Region[] = [
  { id: 'na-ne', emoji: '🍁', size: 84,  color: PB.orange },
  { id: 'na-sw', emoji: '🌵', size: 76,  color: PB.yellow },
  { id: 'eu-uk', emoji: '🇬🇧', size: 62,  color: PB.green  },
  { id: 'eu-md', emoji: '🫒', size: 96,  color: PB.blue   },
  { id: 'sa-am', emoji: '🦋', size: 218, color: PB.purple },
  { id: 'oc-au', emoji: '🦘', size: 142, color: PB.pink   },
  { id: 'as-se', emoji: '🌴', size: 168, color: PB.red    },
];

/**
 * Translation-key suffix for a family row inside a region. The full key
 * is `regions.detail.<regionId>.fam.<famKey>`.
 */
export type RegionFamily = { key: string; count: number; color: string };

/**
 * Translation-key suffix for the "why included" tooltip on a sample
 * species; full key is `regions.detail.<regionId>.why.<bugId>`.
 */
export type RegionSample = { id: string; whyKey: string };

export type RegionDetail = {
  id: string;
  emoji: string;
  color: string;
  species: number;
  size: number;
  version: string;
  updated: string;
  families: RegionFamily[];
  samples: RegionSample[];
  /** Note count — text resolved from `regions.detail.<id>.notes.<i>`. */
  noteCount: number;
};

export const REGION_DETAILS: Record<string, RegionDetail> = {
  'na-ne': {
    id: 'na-ne',
    emoji: '🍁', color: PB.orange,
    species: 2140, size: 84, version: 'v2026.04', updated: 'Apr 12, 2026',
    families: [
      { key: 'lep', count: 612, color: PB.purple },
      { key: 'col', count: 487, color: PB.green  },
      { key: 'hym', count: 321, color: PB.yellow },
      { key: 'dip', count: 278, color: PB.blue   },
      { key: 'odo', count: 164, color: PB.red    },
      { key: 'oth', count: 278, color: PB.cream2 },
    ],
    samples: [
      { id: 'mona', whyKey: 'mona' },
      { id: 'lhoc', whyKey: 'lhoc' },
      { id: 'drag', whyKey: 'drag' },
      { id: 'fire', whyKey: 'fire' },
      { id: 'lady', whyKey: 'lady' },
      { id: 'walk', whyKey: 'walk' },
    ],
    noteCount: 3,
  },
  'na-sw': {
    id: 'na-sw',
    emoji: '🌵', color: PB.yellow,
    species: 1880, size: 76, version: 'v2026.03', updated: 'Mar 28, 2026',
    families: [
      { key: 'hym', count: 524, color: PB.yellow },
      { key: 'col', count: 412, color: PB.green  },
      { key: 'lep', count: 388, color: PB.purple },
      { key: 'hem', count: 246, color: PB.blue   },
      { key: 'ort', count: 168, color: PB.orange },
      { key: 'oth', count: 142, color: PB.cream2 },
    ],
    samples: [
      { id: 'rhin', whyKey: 'rhin' },
      { id: 'mant', whyKey: 'mant' },
      { id: 'lady', whyKey: 'lady' },
      { id: 'cica', whyKey: 'cica' },
      { id: 'walk', whyKey: 'walk' },
      { id: 'mona', whyKey: 'mona' },
    ],
    noteCount: 2,
  },
};
