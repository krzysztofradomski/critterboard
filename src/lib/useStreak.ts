import { useMemo } from "react";

import {
  calendarGrid,
  geotaggedCatches,
  recentBugIds,
  streakSummary,
  todayKey,
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

// `today` in the deps: a screen that stays mounted past midnight recomputes on its next render.
export function useStreakSummary(): StreakSummary {
  const log = useAppStore((s) => s.catchLog);
  const today = todayKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => streakSummary(log), [log, today]);
}

export function useCalendar(days: number): DayCell[] {
  const log = useAppStore((s) => s.catchLog);
  const today = todayKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => calendarGrid(log, days), [log, days, today]);
}

export function useRecentBugIds(n: number): string[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => recentBugIds(log, n), [log, n]);
}

export function useGeotaggedCatches(): CatchEvent[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => geotaggedCatches(log), [log]);
}
