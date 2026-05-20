import type { Rarity } from '@/tokens/pb';

/**
 * Quest-eligibility traits. Multiple traits per bug — a ladybird is both
 * a pollinator (visits flowers) and a beetle. Used by the quest-progress
 * machinery in `src/lib/quests.ts` to decide which counters to bump when
 * `catchBug` fires.
 *
 * Add traits liberally; quests filter against trait *membership* and an
 * over-specified bug can satisfy more goals.
 */
export type BugTrait = 'pollinator' | 'beetle';

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

export const BUGS: Bug[] = [
  { id: 'mona', name: 'Monarch Butterfly',     latin: 'Danaus plexippus',          rarity: 'uncommon',  xp: 40,  tier: '★★',     emoji: '🦋', color: '#e8782c', traits: ['pollinator'] },
  { id: 'rhin', name: 'Rhinoceros Beetle',     latin: 'Xylotrupes ulysses',        rarity: 'rare',      xp: 120, tier: '★★★',    emoji: '🪲', color: '#3d2817', traits: ['beetle'] },
  { id: 'hcat', name: 'Honeybee',              latin: 'Apis mellifera',            rarity: 'common',    xp: 15,  tier: '★',      emoji: '🐝', color: '#f5b400', traits: ['pollinator'] },
  { id: 'mant', name: 'Praying Mantis',        latin: 'Mantis religiosa',          rarity: 'rare',      xp: 95,  tier: '★★★',    emoji: '🦗', color: '#5e8c3a', traits: [] },
  { id: 'lady', name: 'Seven-spot Ladybird',   latin: 'Coccinella septempunctata', rarity: 'common',    xp: 20,  tier: '★',      emoji: '🐞', color: '#d72638', traits: ['beetle', 'pollinator'] },
  { id: 'drag', name: 'Emperor Dragonfly',     latin: 'Anax imperator',            rarity: 'uncommon',  xp: 55,  tier: '★★',     emoji: '🪰', color: '#2a8fb5', traits: [] },
  { id: 'lhoc', name: 'Luna Moth',             latin: 'Actias luna',               rarity: 'legendary', xp: 500, tier: '★★★★★',  emoji: '🌙', color: '#a8e063', traits: ['pollinator'] },
  { id: 'fire', name: 'Common Firefly',        latin: 'Photinus pyralis',          rarity: 'epic',      xp: 240, tier: '★★★★',   emoji: '✨', color: '#fde74c', traits: ['beetle'] },
  { id: 'cica', name: 'Periodical Cicada',     latin: 'Magicicada septendecim',    rarity: 'epic',      xp: 220, tier: '★★★★',   emoji: '🦟', color: '#7a4cae', traits: [] },
  { id: 'hwsp', name: 'Paper Wasp',            latin: 'Polistes dominula',         rarity: 'common',    xp: 18,  tier: '★',      emoji: '🐝', color: '#c9a227', traits: ['pollinator'] },
  { id: 'walk', name: 'Walking Stick',         latin: 'Phasmatodea',               rarity: 'uncommon',  xp: 60,  tier: '★★',     emoji: '🌿', color: '#6f8f4e', traits: [] },
  { id: 'atla', name: 'Atlas Moth',            latin: 'Attacus atlas',             rarity: 'legendary', xp: 600, tier: '★★★★★',  emoji: '🦋', color: '#8b3a1f', traits: ['pollinator'] },
];

export const CAUGHT_IDS: ReadonlySet<string> = new Set([
  'mona', 'hcat', 'lady', 'drag', 'hwsp', 'fire', 'walk',
]);

export function findBug(id: string): Bug | undefined {
  return BUGS.find((b) => b.id === id);
}
