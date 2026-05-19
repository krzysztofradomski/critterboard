import { PB } from '@/tokens/pb';

export type RegionStatus = 'installed' | 'available' | { downloading: number };

export type Region = {
  id: string;
  emoji: string;
  name: string;
  sub: string;
  size: number;
  color: string;
};

export const REGIONS: Region[] = [
  { id: 'na-ne', emoji: '🍁', name: 'Northeast NA',  sub: '2,140 species · trees, ponds, wetlands', size: 84,  color: PB.orange },
  { id: 'na-sw', emoji: '🌵', name: 'Southwest NA',  sub: '1,880 species · desert & chaparral',     size: 76,  color: PB.yellow },
  { id: 'eu-uk', emoji: '🇬🇧', name: 'UK & Ireland',  sub: '1,420 species · hedgerow specialists',   size: 62,  color: PB.green  },
  { id: 'eu-md', emoji: '🫒', name: 'Mediterranean', sub: '2,310 species · Iberia → Anatolia',       size: 96,  color: PB.blue   },
  { id: 'sa-am', emoji: '🦋', name: 'Amazon Basin',  sub: '4,860 species · the big one',             size: 218, color: PB.purple },
  { id: 'oc-au', emoji: '🦘', name: 'Australia',     sub: '3,240 species · everything bites',        size: 142, color: PB.pink   },
  { id: 'as-se', emoji: '🌴', name: 'SE Asia',       sub: '3,690 species · monsoon forests',         size: 168, color: PB.red    },
];

export type RegionFamily = { name: string; count: number; color: string };
export type RegionSample = { id: string; why: string };

export type RegionDetail = {
  emoji: string;
  name: string;
  color: string;
  tagline: string;
  species: number;
  size: number;
  version: string;
  updated: string;
  families: RegionFamily[];
  samples: RegionSample[];
  notes: string[];
};

export const REGION_DETAILS: Record<string, RegionDetail> = {
  'na-ne': {
    emoji: '🍁', name: 'Northeast NA', color: PB.orange,
    tagline: 'Hardwood forests, beaver ponds, salt marsh.',
    species: 2140, size: 84, version: 'v2026.04', updated: 'Apr 12, 2026',
    families: [
      { name: 'Lepidoptera (moths & butterflies)', count: 612, color: PB.purple },
      { name: 'Coleoptera (beetles)',              count: 487, color: PB.green  },
      { name: 'Hymenoptera (wasps & bees)',        count: 321, color: PB.yellow },
      { name: 'Diptera (flies)',                   count: 278, color: PB.blue   },
      { name: 'Odonata (dragonflies)',             count: 164, color: PB.red    },
      { name: 'Other',                             count: 278, color: PB.cream2 },
    ],
    samples: [
      { id: 'mona', why: 'iconic migrant' },
      { id: 'lhoc', why: 'mid-summer emergence' },
      { id: 'drag', why: 'beaver pond regular' },
      { id: 'fire', why: 'June–July dusk' },
      { id: 'lady', why: 'widespread' },
      { id: 'walk', why: 'oak / hickory' },
    ],
    notes: [
      'Salt-marsh species weighted higher than inland average.',
      'Spring–summer phenology baked into the prior; off-season IDs may drop ~6%.',
      'Climate-shift adjustments applied for 2025 ranges.',
    ],
  },
  'na-sw': {
    emoji: '🌵', name: 'Southwest NA', color: PB.yellow,
    tagline: 'Desert, chaparral, montane sky islands.',
    species: 1880, size: 76, version: 'v2026.03', updated: 'Mar 28, 2026',
    families: [
      { name: 'Hymenoptera (native bees + ants)', count: 524, color: PB.yellow },
      { name: 'Coleoptera (darkling beetles)',    count: 412, color: PB.green  },
      { name: 'Lepidoptera',                      count: 388, color: PB.purple },
      { name: 'Hemiptera (true bugs)',            count: 246, color: PB.blue   },
      { name: 'Orthoptera',                       count: 168, color: PB.orange },
      { name: 'Other',                            count: 142, color: PB.cream2 },
    ],
    samples: [
      { id: 'rhin', why: 'monsoon flights' },
      { id: 'mant', why: 'common roadside' },
      { id: 'lady', why: 'widespread' },
      { id: 'cica', why: 'desert chorus' },
      { id: 'walk', why: 'mesquite shrub' },
      { id: 'mona', why: 'spring corridor' },
    ],
    notes: [
      'Native-bee fauna oversampled vs. honey bees.',
      'Desert ant taxonomy still in flux — confidence capped at 92%.',
    ],
  },
};
