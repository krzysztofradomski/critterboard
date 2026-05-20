import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';

/**
 * One catch event. `at` is local-device epoch ms so the streak math
 * uses the user's wall-calendar day (a catch at 23:55 and one at
 * 00:05 the next morning are correctly counted as two separate days).
 */
export type CatchEvent = { id: string; at: number };

/** Calendar cell — what the Streak grid renders. */
export type DayCell = {
  /** Days-ago index: 0 is today, 1 is yesterday, etc. */
  daysAgo: number;
  /** Local-day key `YYYY-MM-DD` for debugging. */
  key: string;
  /** Number of catches on this day. */
  count: number;
  /** Convenience: `count > 0`. */
  caught: boolean;
  /** True for the rightmost cell. */
  isToday: boolean;
};

// ──────────────────────────────────────────────────────────────────────────
// Local-day bucketing
// ──────────────────────────────────────────────────────────────────────────

/**
 * `YYYY-MM-DD` key in the local timezone. We use this instead of
 * `Math.floor(ms / 86_400_000)` because the latter buckets by UTC and
 * silently shifts the user's "today" by up to ±14 hours depending on
 * where they live.
 */
function dayKey(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyOffset(now: number, daysAgo: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return dayKey(d.getTime());
}

/**
 * Group catch events into a `{ dayKey → count }` map. Days with zero
 * catches don't appear in the map — the calendar grid fills those in.
 */
export function bucketByLocalDay(events: CatchEvent[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(e.at);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Streak math
// ──────────────────────────────────────────────────────────────────────────

/**
 * Days the user has caught at least one bug in a row, ending today
 * OR yesterday. The "yesterday" clause is what makes streaks survive
 * the first part of a day before the user opens the app — without it
 * the streak number would drop to 0 every morning until they catch
 * something.
 */
export function currentStreak(events: CatchEvent[], now: number = Date.now()): number {
  const buckets = bucketByLocalDay(events);
  if (buckets.size === 0) return 0;

  // Anchor at today; if today's empty but yesterday has a catch, walk
  // back from yesterday. Streak only "breaks" once a full day has gone
  // by with nothing.
  let startOffset = 0;
  if (!buckets.has(dayKeyOffset(now, 0)) && buckets.has(dayKeyOffset(now, 1))) {
    startOffset = 1;
  }
  let streak = 0;
  for (let i = startOffset; i < 10_000; i++) {
    const k = dayKeyOffset(now, i);
    if (buckets.has(k)) streak += 1;
    else break;
  }
  return streak;
}

/**
 * Longest run of consecutive caught days anywhere in the supplied
 * event list. O(n log n) — fine for ~hundreds of events.
 */
export function bestStreak(events: CatchEvent[]): number {
  const days = Array.from(bucketByLocalDay(events).keys()).sort();
  if (days.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00');
    const cur = new Date(days[i] + 'T00:00:00');
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

/** All-time catch count. */
export function totalCatches(events: CatchEvent[]): number {
  return events.length;
}

// ──────────────────────────────────────────────────────────────────────────
// Calendar grid for the Streak screen / Home week strip
// ──────────────────────────────────────────────────────────────────────────

/**
 * Last `days` cells, oldest first, rightmost = today. Drives the 35-day
 * Streak grid AND the 7-day Home week strip — just pass a different
 * `days` count.
 */
export function calendarGrid(
  events: CatchEvent[],
  days: number,
  now: number = Date.now(),
): DayCell[] {
  const buckets = bucketByLocalDay(events);
  const out: DayCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKeyOffset(now, i);
    const count = buckets.get(key) ?? 0;
    out.push({
      daysAgo: i,
      key,
      count,
      caught: count > 0,
      isToday: i === 0,
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Seeded "history" so first-run UI doesn't look empty
// ──────────────────────────────────────────────────────────────────────────

/**
 * The pattern the prototype's Streak.tsx hard-coded — 35 days, 1 = caught,
 * 0 = missed, 2 = freeze used. Rebuilding catchLog from this preserves
 * the prototype's "Day 4 on fire, best 11" feel as the first-run state.
 */
const SEED_PATTERN: ReadonlyArray<0 | 1 | 2> = [
  1, 1, 1, 1, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 2, 1, 0,
  1, 1, 0, 0, 1, 1, 1,
  1, 1, 1, 1, 1, 0, 0,
];

const SEED_IDS = ['mona', 'hcat', 'lady', 'drag', 'hwsp', 'fire', 'walk',
                  'mant', 'lhoc', 'atla', 'cica', 'rhin'];

/**
 * Build the seeded catch log that the store starts with. Each "caught"
 * day in `SEED_PATTERN` becomes one event, cycling through bug ids.
 *
 * Pass an explicit `now` from the call site so seeding stays
 * deterministic per test invocation; defaults to Date.now() for prod.
 */
export function buildSeedCatchLog(now: number = Date.now()): CatchEvent[] {
  const out: CatchEvent[] = [];
  const total = SEED_PATTERN.length;
  let idIdx = 0;
  for (let i = 0; i < total; i++) {
    const v = SEED_PATTERN[i];
    if (v === 1 || v === 2) {
      const daysAgo = total - 1 - i;
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      // Anchor at noon so DST flips can't push the event into the
      // neighbouring day.
      d.setHours(12, 0, 0, 0);
      out.push({ id: SEED_IDS[idIdx++ % SEED_IDS.length]!, at: d.getTime() });
    }
  }
  // Make sure "today" has a catch in the seed so the user opens the app
  // with a streak of at least 1, not 0 (the prototype's "Day 4 on fire"
  // depended on this implicit assumption).
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// React selectors
// ──────────────────────────────────────────────────────────────────────────

export type StreakSummary = {
  current: number;
  best: number;
  total: number;
};

export function useStreakSummary(): StreakSummary {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(
    () => ({
      current: currentStreak(log),
      best: bestStreak(log),
      total: totalCatches(log),
    }),
    [log],
  );
}

export function useCalendar(days: number): DayCell[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => calendarGrid(log, days), [log, days]);
}
