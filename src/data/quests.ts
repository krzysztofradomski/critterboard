import type { BugTrait } from '@/data/bugs';
import type { Rarity } from '@/tokens/pb';
import { PB } from '@/tokens/pb';

export type QuestKind = 'daily' | 'weekly';

/**
 * What does a quest count? Three flavours:
 *
 *   - `trait`    — bump on catching a bug carrying the given trait
 *                  (e.g. q1: pollinator)
 *   - `rarity`   — bump on catching a bug at-or-above the given rarity
 *                  tier (e.g. q3: legendary)
 *   - `streak`   — progress is the current daily streak (q4); derived,
 *                  not stored
 *
 * The store consults this table inside `catchBug` to figure out which
 * counters to bump. Quests with no entry here are inert.
 */
export type QuestRule =
  | { kind: 'trait'; trait: BugTrait }
  | { kind: 'rarity'; rarity: Rarity }
  | { kind: 'streak' };

export const QUEST_RULES: Record<string, QuestRule> = {
  q1: { kind: 'trait',  trait: 'pollinator' },
  q2: { kind: 'trait',  trait: 'beetle'     },
  q3: { kind: 'rarity', rarity: 'legendary' },
  q4: { kind: 'streak' },
};

/**
 * Quest definition. The user-facing `label`, dialog `desc`, and tip text
 * all resolve to translation keys derived from `id`:
 *
 *   • label  → `quests.labels.<id>`
 *   • desc   → `quests.details.<id>.desc`
 *   • tip N  → `quests.details.<id>.tip<N>`
 */
export type Quest = {
  id: string;
  progress: number;
  total: number;
  reward: number;
  kind: QuestKind;
};

export const QUESTS: Quest[] = [
  { id: 'q1', progress: 2, total: 3, reward: 75,  kind: 'daily'  },
  { id: 'q2', progress: 0, total: 1, reward: 40,  kind: 'daily'  },
  { id: 'q3', progress: 0, total: 1, reward: 500, kind: 'weekly' },
  { id: 'q4', progress: 4, total: 7, reward: 200, kind: 'weekly' },
];

/**
 * Completed quest. `label` and `date` come from
 * `quests.completedLabels.<id>` and `quests.completedDates.<id>`.
 */
export type CompletedQuest = {
  id: string;
  reward: number;
  kind: QuestKind;
  icon: string;
};

export const COMPLETED_QUESTS: CompletedQuest[] = [
  { id: 'c1', reward: 75,  kind: 'daily',  icon: '🌼' },
  { id: 'c2', reward: 30,  kind: 'daily',  icon: '🦋' },
  { id: 'c3', reward: 100, kind: 'weekly', icon: '🔥' },
  { id: 'c4', reward: 50,  kind: 'daily',  icon: '🌙' },
  { id: 'c5', reward: 150, kind: 'weekly', icon: '✋' },
  { id: 'c6', reward: 40,  kind: 'daily',  icon: '🪲' },
  { id: 'c7', reward: 25,  kind: 'daily',  icon: '🌟' },
];

/**
 * Detail-screen metadata. Strings (`desc`, tips) are translation keys.
 * The icon + accent are language-invariant.
 */
export type QuestDetail = {
  icon: string;
  accent: string;
  /** Number of tip strings to read from `quests.details.<id>.tip<N>`. */
  tipCount: number;
};

export const QUEST_DETAILS: Record<string, QuestDetail> = {
  q1: { icon: '🌼', accent: PB.green,  tipCount: 2 },
  q2: { icon: '🪲', accent: PB.green,  tipCount: 2 },
  q3: { icon: '🌟', accent: PB.purple, tipCount: 2 },
  q4: { icon: '🔥', accent: PB.purple, tipCount: 2 },
};
