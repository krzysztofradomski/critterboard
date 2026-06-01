import type { Rarity } from '@/tokens/pb';

/**
 * Quest-eligibility traits. Multiple traits per bug. Used by the
 * quest-progress machinery in `src/lib/quests.ts` to decide which counters
 * to bump when `catchBug` fires.
 */
export type BugTrait = 'pollinator' | 'beetle' | 'butterfly' | 'wasp' | 'damselfly' | 'bug';

export type Bug = {
  id: string;
  name: string;
  latin: string;
  rarity: Rarity;
  xp: number;
  tier: string;
  emoji: string;
  color: string;
  traits: BugTrait[];
};

/** 20 Central European species. IDs mirror src/ai/classMap.ts. */
export const BUGS: Bug[] = [
  // ── Hymenoptera ──────────────────────────────────────────────────────────
  { id: 'hcat', name: 'Honey Bee',              latin: 'Apis mellifera',            rarity: 'common',   xp: 15,  tier: '★',    emoji: '🐝', color: '#f5b400', traits: ['pollinator'] },
  { id: 'buff', name: 'Buff-tailed Bumblebee',  latin: 'Bombus terrestris',         rarity: 'common',   xp: 20,  tier: '★',    emoji: '🐝', color: '#f5a500', traits: ['pollinator'] },
  { id: 'gbee', name: 'Garden Bumblebee',       latin: 'Bombus hortorum',           rarity: 'common',   xp: 20,  tier: '★',    emoji: '🐝', color: '#f0c040', traits: ['pollinator'] },
  { id: 'wasp', name: 'Common Wasp',            latin: 'Vespula vulgaris',          rarity: 'common',   xp: 15,  tier: '★',    emoji: '🐝', color: '#ddc820', traits: ['wasp', 'pollinator'] },
  { id: 'horn', name: 'European Hornet',        latin: 'Vespa crabro',              rarity: 'uncommon', xp: 50,  tier: '★★',   emoji: '🐝', color: '#c87800', traits: ['wasp'] },
  // ── Coleoptera ───────────────────────────────────────────────────────────
  { id: 'lady', name: 'Seven-spot Ladybird',    latin: 'Coccinella septempunctata', rarity: 'common',   xp: 20,  tier: '★',    emoji: '🐞', color: '#d72638', traits: ['beetle', 'pollinator'] },
  { id: 'harl', name: 'Harlequin Ladybird',     latin: 'Harmonia axyridis',         rarity: 'common',   xp: 25,  tier: '★',    emoji: '🐞', color: '#e84500', traits: ['beetle'] },
  { id: 'stag', name: 'Stag Beetle',            latin: 'Lucanus cervus',            rarity: 'rare',     xp: 120, tier: '★★★',  emoji: '🪲', color: '#3d2817', traits: ['beetle'] },
  { id: 'rchf', name: 'Rose Chafer',            latin: 'Cetonia aurata',            rarity: 'uncommon', xp: 60,  tier: '★★',   emoji: '🪲', color: '#2a8c4a', traits: ['beetle', 'pollinator'] },
  // ── Hemiptera ────────────────────────────────────────────────────────────
  { id: 'gshb', name: 'Green Shield Bug',       latin: 'Palomena prasina',          rarity: 'common',   xp: 15,  tier: '★',    emoji: '🪲', color: '#3d8c30', traits: ['bug'] },
  // ── Odonata ──────────────────────────────────────────────────────────────
  { id: 'bdam', name: 'Common Blue Damselfly',  latin: 'Enallagma cyathigerum',     rarity: 'uncommon', xp: 45,  tier: '★★',   emoji: '🪰', color: '#2a8fb5', traits: ['damselfly'] },
  // ── Lepidoptera ──────────────────────────────────────────────────────────
  { id: 'brim', name: 'Common Brimstone',       latin: 'Gonepteryx rhamni',         rarity: 'common',   xp: 20,  tier: '★',    emoji: '🦋', color: '#e8e028', traits: ['butterfly', 'pollinator'] },
  { id: 'peac', name: 'Peacock Butterfly',      latin: 'Aglais io',                 rarity: 'common',   xp: 25,  tier: '★',    emoji: '🦋', color: '#8b1a1a', traits: ['butterfly', 'pollinator'] },
  { id: 'lwhi', name: 'Large White',            latin: 'Pieris brassicae',          rarity: 'common',   xp: 15,  tier: '★',    emoji: '🦋', color: '#c8d8e0', traits: ['butterfly', 'pollinator'] },
  { id: 'swhi', name: 'Small White',            latin: 'Pieris rapae',              rarity: 'common',   xp: 15,  tier: '★',    emoji: '🦋', color: '#d8e8e8', traits: ['butterfly', 'pollinator'] },
  { id: 'orng', name: 'Orange Tip',             latin: 'Anthocharis cardamines',    rarity: 'common',   xp: 20,  tier: '★',    emoji: '🦋', color: '#ff7800', traits: ['butterfly', 'pollinator'] },
  { id: 'radm', name: 'Red Admiral',            latin: 'Vanessa atalanta',          rarity: 'uncommon', xp: 40,  tier: '★★',   emoji: '🦋', color: '#c41e3a', traits: ['butterfly', 'pollinator'] },
  { id: 'tort', name: 'Small Tortoiseshell',    latin: 'Aglais urticae',            rarity: 'uncommon', xp: 40,  tier: '★★',   emoji: '🦋', color: '#e87820', traits: ['butterfly', 'pollinator'] },
  { id: 'pntl', name: 'Painted Lady',           latin: 'Vanessa cardui',            rarity: 'uncommon', xp: 55,  tier: '★★',   emoji: '🦋', color: '#e89060', traits: ['butterfly', 'pollinator'] },
  { id: 'swal', name: 'Common Swallowtail',     latin: 'Papilio machaon',           rarity: 'rare',     xp: 100, tier: '★★★',  emoji: '🦋', color: '#f0d050', traits: ['butterfly', 'pollinator'] },
];

/** Initial dex — bugs the user has already "found" on first launch. */
export const CAUGHT_IDS: ReadonlySet<string> = new Set([
  'hcat', 'lady', 'buff', 'brim', 'peac', 'wasp', 'gshb',
]);

export function findBug(id: string): Bug | undefined {
  return BUGS.find((b) => b.id === id);
}
