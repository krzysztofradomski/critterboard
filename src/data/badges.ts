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
};

export const BADGES: Badge[] = [
  { id: 'b1', icon: '🦋', color: PB.yellow, unlocked: true  },
  { id: 'b2', icon: '🔥', color: PB.orange, unlocked: true  },
  { id: 'b3', icon: '🌙', color: PB.purple, unlocked: true  },
  { id: 'b4', icon: '🌼', color: PB.green,  unlocked: false },
  { id: 'b5', icon: '🔬', color: PB.blue,   unlocked: false },
  { id: 'b6', icon: '🏆', color: PB.red,    unlocked: false },
  { id: 'b7', icon: '✨', color: PB.cream2, unlocked: false },
  { id: 'b8', icon: '✨', color: PB.cream2, unlocked: false },
];

export const BADGES_TOTAL = 24;
