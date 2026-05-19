/**
 * Critterboard design tokens (the "PB" palette in the prototype).
 * Stickered, ink-bordered, deliberately chunky. Every screen layers
 * cream paper over a colored hero band, with 2.5 px ink borders and
 * hard offset shadows.
 */

export const PB = {
  cream: '#fff4dc',
  cream2: '#ffe9b8',
  ink: '#1a1208',
  paper: '#fffaef',
  red: '#ee3d3d',
  orange: '#ff8a3a',
  yellow: '#ffcb24',
  green: '#3ea34d',
  blue: '#2a6df0',
  purple: '#8a4dd4',
  pink: '#ff7eb3',
} as const;

export type PBColor = (typeof PB)[keyof typeof PB];

export const FONTS = {
  display: 'BricolageGrotesque-Bold',
  body: 'BricolageGrotesque-Regular',
  mono: 'JetBrainsMono-Regular',
} as const;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_COLOR: Record<Rarity, string> = {
  common: PB.cream2,
  uncommon: PB.yellow,
  rare: PB.blue,
  epic: PB.purple,
  legendary: PB.pink,
};

export const INK_BORDER = {
  borderColor: PB.ink,
  borderWidth: 2.5,
} as const;

export const HARD_SHADOW = {
  shadowColor: PB.ink,
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 6,
} as const;

export const HARD_SHADOW_SMALL = {
  shadowColor: PB.ink,
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 3,
} as const;

export const HARD_SHADOW_MEDIUM = {
  shadowColor: PB.ink,
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
} as const;
