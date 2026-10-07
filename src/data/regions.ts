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
  /** Total download in MB: model + species list + icons + map. */
  size: number;
  /** Part of `size` that is the offline map (MB); 0 when the region has no map yet. */
  mapSize: number;
  color: string;
};

/**
 * Regions that have a real pack. Keep in sync with `packs/manifest.json`
 * (a test enforces it); every other region renders as "coming soon".
 */
export const AVAILABLE_REGION_IDS: ReadonlySet<string> = new Set(['eu-ce']);

export const REGIONS: Region[] = [
  { id: 'eu-ce', emoji: '🌿', size: 145, mapSize: 56,  color: PB.green  },
  { id: 'na-ne', emoji: '🍁', size: 84, mapSize: 0,  color: PB.orange },
  { id: 'na-sw', emoji: '🌵', size: 76, mapSize: 0,  color: PB.yellow },
  { id: 'eu-uk', emoji: '🇬🇧', size: 62, mapSize: 0,  color: PB.green  },
  { id: 'eu-md', emoji: '🫒', size: 96, mapSize: 0,  color: PB.blue   },
  { id: 'sa-am', emoji: '🦋', size: 218, mapSize: 0, color: PB.purple },
  { id: 'oc-au', emoji: '🦘', size: 142, mapSize: 0, color: PB.pink   },
  { id: 'as-se', emoji: '🌴', size: 168, mapSize: 0, color: PB.red    },
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
  'eu-ce': {
    id: 'eu-ce',
    emoji: '🌿', color: PB.green,
    species: 1004, size: 145, version: 'v2026.10', updated: 'Oct 8, 2026',
    families: [
      { key: 'lep', count: 435, color: PB.purple },
      { key: 'col', count: 148, color: PB.green  },
      { key: 'hem', count: 85,  color: PB.blue   },
      { key: 'hym', count: 76,  color: PB.yellow },
      { key: 'odo', count: 48,  color: PB.red    },
      { key: 'oth', count: 212, color: PB.orange },
    ],
    samples: [
      { id: 'peac', whyKey: 'peac' },
      { id: 'swal', whyKey: 'swal' },
      { id: 'stag', whyKey: 'stag' },
      { id: 'lady', whyKey: 'lady' },
      { id: 'hcat', whyKey: 'hcat' },
      { id: 'bdam', whyKey: 'bdam' },
    ],
    noteCount: 3,
  },
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
      { id: 'peac', whyKey: 'peac' },
      { id: 'swal', whyKey: 'swal' },
      { id: 'stag', whyKey: 'stag' },
      { id: 'lady', whyKey: 'lady' },
      { id: 'hcat', whyKey: 'hcat' },
      { id: 'bdam', whyKey: 'bdam' },
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
      { id: 'buff', whyKey: 'buff' },
      { id: 'rchf', whyKey: 'rchf' },
      { id: 'lady', whyKey: 'lady' },
      { id: 'tort', whyKey: 'tort' },
      { id: 'brim', whyKey: 'brim' },
      { id: 'harl', whyKey: 'harl' },
    ],
    noteCount: 2,
  },
};
