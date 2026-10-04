import { useMemo } from 'react';

import { BADGES, type Badge } from '@/data/badges';
import { findBug } from '@/data/bugs';
import { bestStreak, bucketByLocalDay, type CatchEvent } from '@/lib/streak';
import { useAppStore } from '@/store/useAppStore';

/** How many caught species satisfy a predicate (species the registry doesn't know are skipped). */
function countDex(dex: Set<string>, pred: (b: NonNullable<ReturnType<typeof findBug>>) => boolean): number {
  let n = 0;
  for (const id of dex) {
    const b = findBug(id);
    if (b && pred(b)) n += 1;
  }
  return n;
}

/**
 * Derive badge unlock state from real catch history.
 *
 * Each id has a small, hand-written rule that reads from the catchLog
 * (the source of truth for everything streak-related) plus the dex
 * (uniqueness of species caught).
 *
 * `b7`/`b8` are hidden teasers (`Badge.hidden`): same rules, but the UI
 * keeps their name and criteria secret until they are earned.
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

    case 'b5':
      // Photographer — 10 catches saved with a photo.
      return catchLog.filter((e) => !!e.photoUri).length >= 10;

    case 'b6':
      // Centurion — 100 total catches.
      return catchLog.length >= 100;

    case 'b7':
      // Early Bird — a catch between 04:00 and 07:59 local time.
      return catchLog.some((e) => {
        const h = new Date(e.at).getHours();
        return h >= 4 && h < 8;
      });

    case 'b8':
      // Legend Hunter — any legendary species in the dex.
      return countDex(dex, (b) => b.rarity === 'legendary') >= 1;

    case 'b9':
      // Beetle Mania — 5 distinct beetles.
      return countDex(dex, (b) => b.traits.includes('beetle')) >= 5;

    case 'b10':
      // Wing Collector — 5 distinct butterflies.
      return countDex(dex, (b) => b.traits.includes('butterfly')) >= 5;

    case 'b11':
      // Dex Starter — 10 distinct species.
      return dex.size >= 10;

    case 'b12':
      // Dex Scholar — 50 distinct species.
      return dex.size >= 50;

    case 'b13':
      // Week Warrior — ever hit a 7-day run.
      return bestStreak(catchLog) >= 7;

    case 'b14':
      // Iron Habit — ever hit a 30-day run.
      return bestStreak(catchLog) >= 30;

    case 'b15':
      // Cartographer — 5 catches with a location pinned.
      return catchLog.filter((e) => e.lat !== undefined && e.lng !== undefined).length >= 5;

    case 'b16':
      // Triple Play — 3 catches on one local day.
      return [...bucketByLocalDay(catchLog).values()].some((n) => n >= 3);

    case 'b17':
      // Rare Find — any rare-or-better species in the dex.
      return countDex(dex, (b) => ['rare', 'epic', 'legendary'].includes(b.rarity)) >= 1;

    default:
      return false;
  }
}

/**
 * `BADGES` augmented with live unlock state (everything starts locked).
 */
export function useBadges(): Badge[] {
  const catchLog = useAppStore((s) => s.catchLog);
  const dex = useAppStore((s) => s.dex);
  return useMemo(
    () =>
      BADGES.map((b) => ({
        ...b,
        unlocked: isBadgeUnlocked(b.id, catchLog, dex),
      })),
    [catchLog, dex],
  );
}
