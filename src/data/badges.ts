import { PB } from '@/tokens/pb';

/**
 * Badge definition. All user-facing strings (`name`, `desc`, `crit`,
 * `earned` date) resolve from `badges.items.<id>.<field>` in the active
 * translation pack. Locked badges that read as "???" in English use the
 * `badges.uncaughtName` placeholder per language.
 */
export type Badge = {
  id: string;
  icon: string;
  color: string;
  unlocked: boolean;
  /** Teaser: name, icon and criteria stay secret until it is earned. */
  hidden?: boolean;
};

export const BADGES: Badge[] = [
  { id: 'b1',  icon: '🦋', color: PB.yellow, unlocked: false },
  { id: 'b2',  icon: '🔥', color: PB.orange, unlocked: false },
  { id: 'b3',  icon: '🌙', color: PB.purple, unlocked: false },
  { id: 'b4',  icon: '🌼', color: PB.green,  unlocked: false },
  { id: 'b5',  icon: '📸', color: PB.blue,   unlocked: false },
  { id: 'b6',  icon: '🏆', color: PB.red,    unlocked: false },
  { id: 'b9',  icon: '🪲', color: PB.green,  unlocked: false },
  { id: 'b10', icon: '🦋', color: PB.pink,   unlocked: false },
  { id: 'b11', icon: '📖', color: PB.yellow, unlocked: false },
  { id: 'b12', icon: '🎓', color: PB.blue,   unlocked: false },
  { id: 'b13', icon: '🗓️', color: PB.orange, unlocked: false },
  { id: 'b14', icon: '🛡️', color: PB.red,    unlocked: false },
  { id: 'b15', icon: '📍', color: PB.green,  unlocked: false },
  { id: 'b16', icon: '🎯', color: PB.purple, unlocked: false },
  { id: 'b17', icon: '💎', color: PB.blue,   unlocked: false },
  { id: 'b7',  icon: '🌅', color: PB.orange, unlocked: false, hidden: true },
  { id: 'b8',  icon: '👑', color: PB.purple, unlocked: false, hidden: true },
];

/** Every badge starts locked; useBadges() derives the real state from the catch history. */
export const BADGES_TOTAL = BADGES.length;
