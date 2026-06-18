import { useMemo } from "react";

import {
  COMPLETED_QUESTS,
  QUESTS,
  QUEST_DETAILS,
  QUEST_RULES,
  type CompletedQuest,
  type Quest,
} from "@/data/quests";
import { claimStateOf, type ClaimState } from "@/lib/quests";
import { currentStreak } from "@/lib/streak";
import { useAppStore } from "@/store/useAppStore";

export type { ClaimState };

export function useCompletedQuests(): CompletedQuest[] {
  const completedAt = useAppStore((s) => s.questCompletedAt);
  return useMemo(() => {
    const realIds = Object.keys(completedAt);
    if (realIds.length === 0) return COMPLETED_QUESTS;
    const items: CompletedQuest[] = [];
    for (const id of realIds) {
      const q = QUESTS.find((x) => x.id === id);
      const d = QUEST_DETAILS[id];
      const at = completedAt[id];
      if (!q || !d || at === undefined) continue;
      items.push({
        id: q.id,
        reward: q.reward,
        kind: q.kind,
        icon: d.icon,
        completedAt: at,
      });
    }
    items.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    return items;
  }, [completedAt]);
}

export function useClaimState(quest: Quest): ClaimState {
  const claimed = useAppStore((s) => s.questClaimedAt);
  return useMemo(
    () => claimStateOf(quest.id, quest.progress, quest.total, claimed),
    [quest.id, quest.progress, quest.total, claimed],
  );
}

export function useQuests(): Quest[] {
  const questProgress = useAppStore((s) => s.questProgress);
  const catchLog = useAppStore((s) => s.catchLog);
  return useMemo(() => {
    const streak = currentStreak(catchLog);
    return QUESTS.map((q) => {
      let progress = questProgress[q.id] ?? q.progress;
      if (QUEST_RULES[q.id]?.kind === "streak") progress = streak;
      return { ...q, progress: Math.min(q.total, progress) };
    });
  }, [questProgress, catchLog]);
}
