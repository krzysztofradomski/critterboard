import { useMemo } from 'react';

import { BUGS, findBug } from '@/data/bugs';
import { LEADERS } from '@/data/leaderboard';
import { useAppStore } from '@/store/useAppStore';

/**
 * Progression model.
 *
 * Cumulative XP required to *enter* level `L` is `(L - 1)² × 100`:
 *
 *   Level 1 →    0 XP
 *   Level 2 →  100 XP
 *   Level 3 →  400 XP
 *   Level 4 →  900 XP
 *   Level 5 → 1,600 XP
 *   ...
 *
 * The curve was picked to roughly land the seeded dex (≈450 XP) at
 * level 3 with a believable progress bar toward 4. It's also gentle
 * enough that the first few catches feel like immediate wins.
 *
 * All values are derived — never persisted — so changing the curve
 * later is a one-file patch.
 */

export type LevelInfo = {
  /** Current level, 1-indexed. */
  level: number;
  /** Cumulative XP earned. */
  xp: number;
  /** XP earned within the current level (`xp - prevAt`). */
  into: number;
  /** XP span between this level's floor and the next. */
  span: number;
  /** Absolute cumulative XP required to reach `level + 1`. */
  nextAt: number;
};

/**
 * Pure: sum of `xp` over every bug whose id is in the supplied dex.
 * Unknown ids are silently skipped — the dex Set is the source of
 * truth, but `BUGS` is what knows how much XP each id is worth.
 */
export function xpFromDex(dex: Iterable<string>): number {
  let total = 0;
  for (const id of dex) {
    const b = findBug(id);
    if (b) total += b.xp;
  }
  return total;
}

/**
 * Total XP awarded if every bug in the species DB were caught — the
 * theoretical ceiling. Useful for the dex-completion progress bar.
 */
export const MAX_XP = BUGS.reduce((sum, b) => sum + b.xp, 0);

/**
 * Pure: derive level + progress from an XP total. Stable across
 * renders, safe to call from store actions, no React imports.
 */
export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  // floor(sqrt(xp / 100)) + 1, i.e. the largest L where (L-1)²·100 ≤ xp.
  const level = Math.floor(Math.sqrt(safe / 100)) + 1;
  const prevAt = (level - 1) * (level - 1) * 100;
  const nextAt = level * level * 100;
  return {
    level,
    xp: safe,
    into: safe - prevAt,
    span: nextAt - prevAt,
    nextAt,
  };
}

/**
 * Format an XP count for the chunky pill displays:
 *
 *   xp <   1_000  → "342"
 *   xp <  10_000  → "1.2k"
 *   xp < 100_000  → "24.6k"
 *   xp ≥ 100_000  → "120k"
 *
 * The locale-aware decimal separator is deliberately *not* used here —
 * the design treats these numbers as iconography, not as currency.
 */
export function formatXp(xp: number): string {
  if (xp < 1000) return String(Math.floor(xp));
  if (xp < 10_000) return `${(xp / 1000).toFixed(1)}k`;
  if (xp < 100_000) return `${(xp / 1000).toFixed(1)}k`;
  return `${Math.floor(xp / 1000)}k`;
}

// ──────────────────────────────────────────────────────────────────────────
// React selectors
// ──────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to dex changes and returns the derived XP total.
 * Re-renders only when the dex Set identity changes (i.e. on catch).
 */
export function useXp(): number {
  const dex = useAppStore((s) => s.dex);
  return useMemo(() => xpFromDex(dex), [dex]);
}

export function useLevel(): LevelInfo {
  const xp = useXp();
  return useMemo(() => levelFromXp(xp), [xp]);
}

/**
 * Synthetic global rank — how many roster trainers currently have *more*
 * XP than the user, +1. Lets the Home and Leaderboard screens show an
 * actually-correct rank instead of the hard-coded "#6" the prototype shipped.
 *
 * The `LEADERS` roster is still synthetic seed data — when a real backend
 * arrives, this function gets pointed at a paginated leaderboard query and
 * the rest of the app doesn't change.
 */
export function rankFromXp(xp: number): number {
  let rank = 1;
  for (const row of LEADERS) {
    if (row.self) continue;
    if (row.xp > xp) rank += 1;
  }
  return rank;
}

export function useRank(): number {
  const xp = useXp();
  return useMemo(() => rankFromXp(xp), [xp]);
}

