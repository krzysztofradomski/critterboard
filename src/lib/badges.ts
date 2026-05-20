import { useMemo } from 'react';

import { BADGES, type Badge } from '@/data/badges';
import { findBug } from '@/data/bugs';
import { bestStreak, type CatchEvent } from '@/lib/streak';
import { useAppStore } from '@/store/useAppStore';

/**
 * Derive badge unlock state from real catch history.
 *
 * Each id has a small, hand-written rule that reads from the catchLog
 * (the source of truth for everything streak-related) plus the dex
 * (uniqueness of species caught).
 *
 * `b5` (Splitter) needs a "lookalike correctly distinguished" signal
 * we don't track yet; `b7`/`b8` are deliberate hidden teasers. Both
 * fall through to `false` here — the static `unlocked` field still
 * wins where the prototype shipped a true, so the seeded UI doesn't
 * regress.
 */
export function isBadgeUnlocked(
  id: string,
  catchLog: CatchEvent[],
  dex: Set<string>,
): boolean {
  switch (id) {
    case 'b1':
      // First Catch — any event at all.
      return catchLog.length > 0;

    case 'b2':
      // Streak 3 — ever hit a 3-day run, freezes included.
      return bestStreak(catchLog) >= 3;

    case 'b3':
      // Night Owl — a catch between 21:00 and 04:00 local time.
      return catchLog.some((e) => {
        const h = new Date(e.at).getHours();
        return h >= 21 || h < 4;
      });

    case 'b4': {
      // Pollinator Pal — 10 *distinct* pollinator species caught.
      const seen = new Set<string>();
      for (const id_ of dex) {
        const b = findBug(id_);
        if (b?.traits.includes('pollinator')) seen.add(id_);
      }
      return seen.size >= 10;
    }

    case 'b6':
      // Centurion — 100 total catches.
      return catchLog.length >= 100;

    default:
      // b5 / b7 / b8 — no derivation rule yet.
      return false;
  }
}

/**
 * `BADGES` augmented with live unlock state. We OR with the static
 * `unlocked` so badges the prototype shipped as already-earned stay
 * earned even before the user accumulates the derivation criteria.
 */
export function useBadges(): Badge[] {
  const catchLog = useAppStore((s) => s.catchLog);
  const dex = useAppStore((s) => s.dex);
  return useMemo(
    () =>
      BADGES.map((b) => ({
        ...b,
        unlocked: b.unlocked || isBadgeUnlocked(b.id, catchLog, dex),
      })),
    [catchLog, dex],
  );
}
