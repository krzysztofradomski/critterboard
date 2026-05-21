import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';

/**
 * One catch event. `at` is local-device epoch ms so the streak math
 * uses the user's wall-calendar day (a catch at 23:55 and one at
 * 00:05 the next morning are correctly counted as two separate days).
 *
 * `photoUri` (when present) points at a file in the device cache that
 * was captured or picked during the scan that produced this catch. The
 * field is optional: seeded history has none, and platforms where the
 * camera capture failed silently fall back to undefined.
 *
 * `lat` / `lng` (when present) come from `expo-location` at catch time,
 * gated on `profile.locationShareOn`. Drives the user's pins on the
 * Map screen. Both fields are optional and travel together.
 */
export type CatchEvent = {
  id: string;
  at: number;
  photoUri?: string;
  lat?: number;
  lng?: number;
};

/** Calendar cell — what the Streak grid renders. */
export type DayCell = {
  /** Days-ago index: 0 is today, 1 is yesterday, etc. */
  daysAgo: number;
  /** Local-day key `YYYY-MM-DD` for debugging. */
  key: string;
  /** Number of catches on this day. */
  count: number;
  /** True if the user caught at least one bug that day. */
  caught: boolean;
  /** True if a banked freeze covered a miss on this day. */
  freeze: boolean;
  /** True for the rightmost cell. */
  isToday: boolean;
};

export const MAX_BANKED_FREEZES = 3;
const CATCHES_PER_FREEZE = 7;

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
// Freeze accounting
// ──────────────────────────────────────────────────────────────────────────

/**
 * Replay the catch history chronologically to figure out where freezes
 * were earned, where they were spent (which missed days got saved),
 * and how many are banked right now.
 *
 * Rules:
 *   - Every 7 caught days earns +1 freeze. Bank capped at MAX_BANKED_FREEZES.
 *   - Each missed day immediately spends 1 freeze if the bank > 0.
 *   - A missed day with an empty bank is a real break.
 *
 * The walk only covers the span between the first catch and today
 * (inclusive). Days before the first catch don't exist for streak
 * purposes — no need to penalize the user for not using the app
 * before they installed it.
 */
export type FreezeState = {
  /** dayKeys where a banked freeze covered a missed day. */
  spent: Set<string>;
  /** Currently banked freezes (after replay through today). */
  available: number;
};

export function computeFreezeState(
  events: CatchEvent[],
  now: number = Date.now(),
): FreezeState {
  const buckets = bucketByLocalDay(events);
  if (buckets.size === 0) {
    return { spent: new Set(), available: 0 };
  }

  // Find first catch — that's the start of the walk.
  let firstAt = Infinity;
  for (const e of events) if (e.at < firstAt) firstAt = e.at;

  // Walk from firstKey through today, day by day.
  const todayKey = dayKey(now);
  const spent = new Set<string>();
  let banked = 0;
  let caughtRunForEarn = 0;

  const cursor = new Date(firstAt);
  cursor.setHours(12, 0, 0, 0);
  // Safety cap so a corrupt clock can't loop forever.
  for (let i = 0; i < 10_000; i++) {
    const k = dayKey(cursor.getTime());
    if (buckets.has(k)) {
      caughtRunForEarn += 1;
      if (caughtRunForEarn % CATCHES_PER_FREEZE === 0 && banked < MAX_BANKED_FREEZES) {
        banked += 1;
      }
    } else {
      // Missed day. Spend a freeze if we have one, else break the run.
      if (banked > 0) {
        banked -= 1;
        spent.add(k);
      } else {
        caughtRunForEarn = 0;
      }
    }
    if (k === todayKey) break;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { spent, available: banked };
}

// ──────────────────────────────────────────────────────────────────────────
// Streak math
// ──────────────────────────────────────────────────────────────────────────

/**
 * Days the user has caught at least one bug in a row, ending today
 * OR yesterday. Days protected by a freeze (per `computeFreezeState`)
 * count as if caught. The "yesterday" clause is what makes streaks
 * survive the first part of a day before the user opens the app.
 */
export function currentStreak(events: CatchEvent[], now: number = Date.now()): number {
  const buckets = bucketByLocalDay(events);
  if (buckets.size === 0) return 0;
  const { spent } = computeFreezeState(events, now);

  let startOffset = 0;
  const todayCaught = buckets.has(dayKeyOffset(now, 0));
  const ydayCaught = buckets.has(dayKeyOffset(now, 1));
  if (!todayCaught && ydayCaught) startOffset = 1;

  let streak = 0;
  for (let i = startOffset; i < 10_000; i++) {
    const k = dayKeyOffset(now, i);
    if (buckets.has(k) || spent.has(k)) streak += 1;
    else break;
  }
  return streak;
}

/**
 * Longest run of consecutive caught-or-freeze-saved days anywhere in
 * the supplied history. Includes freeze-protected days.
 */
export function bestStreak(events: CatchEvent[], now: number = Date.now()): number {
  const caught = bucketByLocalDay(events);
  if (caught.size === 0) return 0;
  const { spent } = computeFreezeState(events, now);

  // Combine caught + freeze-spent into one sorted day list.
  const days = new Set<string>([...caught.keys(), ...spent]);
  const sorted = Array.from(days).sort();

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const cur = new Date(sorted[i] + 'T00:00:00');
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
  const { spent } = computeFreezeState(events, now);
  const out: DayCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKeyOffset(now, i);
    const count = buckets.get(key) ?? 0;
    out.push({
      daysAgo: i,
      key,
      count,
      caught: count > 0,
      freeze: spent.has(key),
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
 * the prototype's "Day 4 on fire" feel as the first-run state.
 *
 * Freeze-marked days (`2`) become real missed days in the seed log —
 * the freeze-replay above derives the protection without needing a
 * second source of truth.
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
 */
export function buildSeedCatchLog(now: number = Date.now()): CatchEvent[] {
  const out: CatchEvent[] = [];
  const total = SEED_PATTERN.length;
  let idIdx = 0;
  for (let i = 0; i < total; i++) {
    const v = SEED_PATTERN[i];
    if (v === 1) {
      const daysAgo = total - 1 - i;
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      // Anchor at noon so DST flips can't push the event into the
      // neighbouring day.
      d.setHours(12, 0, 0, 0);
      out.push({ id: SEED_IDS[idIdx++ % SEED_IDS.length]!, at: d.getTime() });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// React selectors
// ──────────────────────────────────────────────────────────────────────────

export type StreakSummary = {
  current: number;
  best: number;
  total: number;
  /** Number of freezes currently banked (0..MAX_BANKED_FREEZES). */
  freezes: number;
};

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

// ──────────────────────────────────────────────────────────────────────────
// Recent-catch helpers (for Home strip)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Last N **distinct** bug ids by catch time, newest first.
 *
 * "Distinct" because the Home strip is "Recent finds" — re-catching the
 * same bug shouldn't push earlier finds out of the strip.
 */
export function recentBugIds(events: CatchEvent[], n: number): string[] {
  const sorted = [...events].sort((a, b) => b.at - a.at);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e.id);
    if (out.length >= n) break;
  }
  return out;
}

export function useRecentBugIds(n: number): string[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => recentBugIds(log, n), [log, n]);
}

/**
 * Newest-first list of catch events that carry GPS coordinates. The Map
 * screen uses this to render real user catches as pins alongside the
 * synthetic `SIGHTINGS` dataset.
 */
export function geotaggedCatches(events: ReadonlyArray<CatchEvent>): CatchEvent[] {
  const out: CatchEvent[] = [];
  for (const e of events) {
    if (e.lat !== undefined && e.lng !== undefined) out.push(e);
  }
  out.sort((a, b) => b.at - a.at);
  return out;
}

export function useGeotaggedCatches(): CatchEvent[] {
  const log = useAppStore((s) => s.catchLog);
  return useMemo(() => geotaggedCatches(log), [log]);
}

/**
 * Most-recent stored photo URI for a given bug, or undefined if none of
 * the catches for that bug carry a photo (e.g. the seeded history).
 * Used by Dex tile taps to deep-link into Result with the real picture.
 */
export function latestPhotoFor(events: ReadonlyArray<CatchEvent>, bugId: string): string | undefined {
  let bestAt = -Infinity;
  let bestUri: string | undefined;
  for (const e of events) {
    if (e.id !== bugId || !e.photoUri) continue;
    if (e.at > bestAt) {
      bestAt = e.at;
      bestUri = e.photoUri;
    }
  }
  return bestUri;
}
