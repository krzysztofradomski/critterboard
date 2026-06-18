import { findBug } from "@/data/bugs";
import { QUESTS, QUEST_RULES, type QuestRule } from "@/data/quests";
import type { Rarity } from "@/tokens/pb";

/** Ordered weakest → strongest. Used by the rarity rule. */
const RARITY_ORDER: ReadonlyArray<Rarity> = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
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
export function catchSatisfiesRule(rule: QuestRule, bugId: string): boolean {
  const bug = findBug(bugId);
  if (!bug) return false;
  if (rule.kind === "trait") return bug.traits.includes(rule.trait);
  if (rule.kind === "rarity") {
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
// Claim state (pure)
// ──────────────────────────────────────────────────────────────────────────

/**
 * For a quest with progress vs total, decide its claim state:
 *   - `unready`  → progress < total, no claim CTA
 *   - `claimable` → progress >= total, reward not yet collected
 *   - `claimed`  → reward already collected, sticky for the dex lifetime
 *
 * The component picks the right CTA off this. The store enforces the
 * same rules in `claimQuest` — this hook is just for rendering.
 */
export type ClaimState = "unready" | "claimable" | "claimed";

export function claimStateOf(
  questId: string,
  progress: number,
  total: number,
  claimed: Record<string, number>,
): ClaimState {
  if (claimed[questId] !== undefined) return "claimed";
  if (progress >= total) return "claimable";
  return "unready";
}
