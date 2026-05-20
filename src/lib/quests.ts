import { useMemo } from 'react';

import { findBug } from '@/data/bugs';
import { QUESTS, QUEST_RULES, type Quest, type QuestRule } from '@/data/quests';
import type { Rarity } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { currentStreak } from '@/lib/streak';

/** Ordered weakest → strongest. Used by the rarity rule. */
const RARITY_ORDER: ReadonlyArray<Rarity> = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
];

export function rarityIndex(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/**
 * Resolve a quest template against a single catch — does this catch
 * count toward this quest? Pure; no React, no store access.
 *
 * Used by the store's `catchBug` to know which `questProgress[id]`
 * counters to bump.
 */
export function catchSatisfiesRule(
  rule: QuestRule,
  bugId: string,
): boolean {
  const bug = findBug(bugId);
  if (!bug) return false;
  if (rule.kind === 'trait') return bug.traits.includes(rule.trait);
  if (rule.kind === 'rarity') {
    return rarityIndex(bug.rarity) >= rarityIndex(rule.rarity);
  }
  // 'streak' rules don't fire on individual catches — they're derived.
  return false;
}

/**
 * For a given catch, return the list of quest ids whose counters
 * should bump by 1. Quests already at `total` are not in the list —
 * the store doesn't need to keep counting after completion.
 */
export function questsAdvancedBy(
  bugId: string,
  questProgress: Record<string, number>,
): string[] {
  const out: string[] = [];
  for (const q of QUESTS) {
    const rule = QUEST_RULES[q.id];
    if (!rule) continue;
    const cur = questProgress[q.id] ?? q.progress;
    if (cur >= q.total) continue;
    if (catchSatisfiesRule(rule, bugId)) out.push(q.id);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// React selectors
// ──────────────────────────────────────────────────────────────────────────

/**
 * Merge the static quest templates with live progress from the store.
 * `q4` is special: its progress IS the current streak, not a stored
 * counter — keeps the streak quest in lock-step with the streak chip
 * on Home and the Streak screen.
 */
export function useQuests(): Quest[] {
  const questProgress = useAppStore((s) => s.questProgress);
  const catchLog = useAppStore((s) => s.catchLog);
  return useMemo(() => {
    const streak = currentStreak(catchLog);
    return QUESTS.map((q) => {
      let progress = questProgress[q.id] ?? q.progress;
      if (QUEST_RULES[q.id]?.kind === 'streak') progress = streak;
      return { ...q, progress: Math.min(q.total, progress) };
    });
  }, [questProgress, catchLog]);
}
