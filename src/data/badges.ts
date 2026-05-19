import { PB } from '@/tokens/pb';

export type Badge = {
  id: string;
  icon: string;
  name: string;
  color: string;
  unlocked: boolean;
  earned?: string;
  hint?: string;
  desc: string;
  crit: string;
};

export const BADGES: Badge[] = [
  {
    id: 'b1', icon: '🦋', name: 'First Catch', color: PB.yellow, unlocked: true, earned: 'Apr 12',
    desc: 'Your very first ID. Welcome to the club — every naturalist has this one tucked in the front of their notebook.',
    crit: 'Identify your first bug.',
  },
  {
    id: 'b2', icon: '🔥', name: 'Streak 3', color: PB.orange, unlocked: true, earned: 'May 04',
    desc: 'Three days of paying attention in a row. The hard part is starting; the harder part is showing up tomorrow.',
    crit: 'ID at least one bug, three days running.',
  },
  {
    id: 'b3', icon: '🌙', name: 'Night Owl', color: PB.purple, unlocked: true, earned: 'May 09',
    desc: 'You went out after dark with a flashlight and found something looking back. Moths salute you.',
    crit: 'Identify a bug between 9pm and 4am.',
  },
  {
    id: 'b4', icon: '🌼', name: 'Pollinator Pal', color: PB.green, unlocked: false, hint: 'ID 10 pollinators',
    desc: "For the friends of flowers. Bees, butterflies, hoverflies, beetles — anything that's there for the nectar.",
    crit: 'Identify 10 different pollinators.',
  },
  {
    id: 'b5', icon: '🔬', name: 'Splitter', color: PB.blue, unlocked: false, hint: 'ID 5 lookalikes correctly',
    desc: 'You can tell a hoverfly from a wasp at twenty paces. Lumpers fear you.',
    crit: 'Correctly distinguish 5 mimic species.',
  },
  {
    id: 'b6', icon: '🏆', name: 'Centurion', color: PB.red, unlocked: false, hint: '100 IDs',
    desc: 'One hundred IDs. The kind of milestone that gets a little gold ribbon on it.',
    crit: 'Reach 100 total identifications.',
  },
  {
    id: 'b7', icon: '✨', name: '???', color: PB.cream2, unlocked: false,
    desc: 'Locked. Keep hunting and this one will reveal itself.',
    crit: 'Hidden until you earn it.',
  },
  {
    id: 'b8', icon: '✨', name: '???', color: PB.cream2, unlocked: false,
    desc: 'Locked. Keep hunting and this one will reveal itself.',
    crit: 'Hidden until you earn it.',
  },
];

export const BADGES_TOTAL = 24;
