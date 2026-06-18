import { useMemo } from "react";

import {
  bestStreak,
  calendarGrid,
  computeFreezeState,
  currentStreak,
  geotaggedCatches,
  recentBugIds,
  totalCatches,
  type CatchEvent,
  type DayCell,
} from "@/lib/streak";
import { useAppStore } from "@/store/useAppStore";

export type StreakSummary = {
  current: number;
  best: number;
  total: number;
  /** Number of freezes currently banked (0..MAX_BANKED_FREEZES). */
  freezes: number;
};

export type { DayCell };

export function useStreakSummary(): StreakSummary {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(
    () => ({
      current: currentStreak(log),
      best: bestStreak(log),
      total: totalCatches(log),
      freezes: computeFreezeState(log).available,
    }),
    [log],
  );
}

export function useCalendar(days: number): DayCell[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => calendarGrid(log, days), [log, days]);
}

export function useRecentBugIds(n: number): string[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => recentBugIds(log, n), [log, n]);
}

export function useGeotaggedCatches(): CatchEvent[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => geotaggedCatches(log), [log]);
}
