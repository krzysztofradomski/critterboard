import { PB } from '@/tokens/pb';

export type QuestKind = 'daily' | 'weekly';

export type Quest = {
  id: string;
  label: string;
  progress: number;
  total: number;
  reward: number;
  kind: QuestKind;
};

export const QUESTS: Quest[] = [
  { id: 'q1', label: 'Identify 3 pollinators', progress: 2, total: 3, reward: 75,  kind: 'daily'  },
  { id: 'q2', label: 'Catch a beetle',          progress: 0, total: 1, reward: 40,  kind: 'daily'  },
  { id: 'q3', label: 'Find a Legendary',        progress: 0, total: 1, reward: 500, kind: 'weekly' },
  { id: 'q4', label: '7-day streak',            progress: 4, total: 7, reward: 200, kind: 'weekly' },
];

export type CompletedQuest = {
  id: string;
  label: string;
  date: string;
  reward: number;
  kind: QuestKind;
  icon: string;
};

export const COMPLETED_QUESTS: CompletedQuest[] = [
  { id: 'c1', label: 'Identify 5 pollinators', date: 'Today',      reward: 75,  kind: 'daily',  icon: '🌼' },
  { id: 'c2', label: 'Catch a butterfly',      date: 'Yesterday',  reward: 30,  kind: 'daily',  icon: '🦋' },
  { id: 'c3', label: '3-day streak',           date: '2 days ago', reward: 100, kind: 'weekly', icon: '🔥' },
  { id: 'c4', label: 'First night-time ID',    date: 'May 09',     reward: 50,  kind: 'daily',  icon: '🌙' },
  { id: 'c5', label: 'Identify 10 in a week',  date: 'May 06',     reward: 150, kind: 'weekly', icon: '✋' },
  { id: 'c6', label: 'Catch a beetle',         date: 'May 02',     reward: 40,  kind: 'daily',  icon: '🪲' },
  { id: 'c7', label: 'First Catch',            date: 'Apr 12',     reward: 25,  kind: 'daily',  icon: '🌟' },
];

export type QuestDetail = {
  icon: string;
  accent: string;
  desc: string;
  tips: string[];
};

export const QUEST_DETAILS: Record<string, QuestDetail> = {
  q1: {
    icon: '🌼',
    accent: PB.green,
    desc: "Pollinators keep the world fed. Find and ID three of them today — bees, butterflies, hoverflies, beetles, anything that visits a flower for a snack.",
    tips: [
      'Honeybees count, hoverflies count, even beetles on flowers count.',
      'Morning sun + a flowering patch is the cheat code.',
    ],
  },
  q2: {
    icon: '🪲',
    accent: PB.green,
    desc: 'Beetles. Crunchy. Misunderstood. Bag yourself any species in order Coleoptera.',
    tips: [
      'Flip a log (gently) — most beetles love the dark.',
      'Try the underside of leaves at dusk.',
    ],
  },
  q3: {
    icon: '🌟',
    accent: PB.purple,
    desc: 'A real trophy. Track down a Legendary-tier insect this week. Luna Moth, Atlas Moth, or anything wearing five stars.',
    tips: [
      'Legendaries cluster at dusk near porch lights.',
      'Check the Map for recent rare sightings nearby.',
    ],
  },
  q4: {
    icon: '🔥',
    accent: PB.purple,
    desc: "ID at least one bug a day for seven days in a row. Doesn't matter what — a single ant counts.",
    tips: [
      'Missed a day? Toughens you up. Start the count again.',
      'Set a reminder when your streak hits 5 — the home stretch is brutal.',
    ],
  },
};
