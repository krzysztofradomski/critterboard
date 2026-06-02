import { vi, describe, it, expect } from 'vitest';

// streak.ts re-exports React hooks that import the store, which in turn
// imports streak.ts (circular). Mocking the store breaks the cycle so
// the pure-function exports load cleanly.
vi.mock('@/store/useAppStore', () => ({
  useAppStore: Object.assign(() => undefined, {
    getState: () => ({ catchLog: [] }),
    setState: () => {},
    subscribe: () => () => {},
  }),
}));

import {
  bucketByLocalDay,
  computeFreezeState,
  currentStreak,
  bestStreak,
  totalCatches,
  calendarGrid,
  recentBugIds,
  geotaggedCatches,
  latestPhotoFor,
  buildSeedCatchLog,
  type CatchEvent,
} from '@/lib/streak';

function msAt(daysAgo: number, hours = 12): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, 0, 0, 0);
  return d.getTime();
}

function ev(id: string, daysAgo: number, hours = 12): CatchEvent {
  return { id, at: msAt(daysAgo, hours) };
}

describe('bucketByLocalDay', () => {
  it('returns empty map for empty input', () => {
    expect(bucketByLocalDay([])).toEqual(new Map());
  });

  it('groups events by calendar day', () => {
    const events = [ev('a', 0), ev('b', 0), ev('c', 1)];
    const map = bucketByLocalDay(events);
    expect(map.size).toBe(2);
    const todayKey = [...map.entries()].find(([, v]) => v === 2)?.[0];
    expect(todayKey).toBeDefined();
  });

  it('counts multiple catches on the same day', () => {
    const events = [ev('a', 0), ev('b', 0), ev('c', 0)];
    const map = bucketByLocalDay(events);
    expect(map.size).toBe(1);
    const count = [...map.values()][0];
    expect(count).toBe(3);
  });
});

describe('currentStreak (U-S-*)', () => {
  it('U-S-01: no catches → streak 0', () => {
    expect(currentStreak([])).toBe(0);
  });

  it('U-S-02: single catch today → streak 1', () => {
    expect(currentStreak([ev('a', 0)])).toBe(1);
  });

  it('U-S-03: consecutive days → correct streak', () => {
    const events = [ev('a', 0), ev('b', 1), ev('c', 2)];
    expect(currentStreak(events)).toBe(3);
  });

  it('U-S-04: gap in chain resets current streak', () => {
    // caught today and 3,4 days ago → current = 1 (gap on day 1 and 2)
    const events = [ev('a', 0), ev('b', 3), ev('c', 4)];
    expect(currentStreak(events)).toBe(1);
  });

  it('U-S-05: multiple catches same day count as one streak day', () => {
    const events = [ev('a', 0), ev('b', 0), ev('c', 0)];
    expect(currentStreak(events)).toBe(1);
  });

  it('U-S-08: streak continues correctly across a month boundary', () => {
    // Build 10 consecutive days ending today
    const events = Array.from({ length: 10 }, (_, i) => ev(`bug${i}`, i));
    expect(currentStreak(events)).toBe(10);
  });

  it('U-S-09: far-future catch is not counted in streak', () => {
    const futureMs = Date.now() + 48 * 3600 * 1000;
    const events: CatchEvent[] = [{ id: 'future', at: futureMs }];
    // Future event: streak should be 0 (no catch today or yesterday)
    expect(currentStreak(events)).toBe(0);
  });

  it('streak counts yesterday as active (grace period)', () => {
    const events = [ev('a', 1), ev('b', 2), ev('c', 3)];
    expect(currentStreak(events)).toBe(3);
  });
});

describe('bestStreak', () => {
  it('returns 0 for empty log', () => {
    expect(bestStreak([])).toBe(0);
  });

  it('returns 1 for single catch', () => {
    expect(bestStreak([ev('a', 0)])).toBe(1);
  });

  it('tracks the longest run, not the current one', () => {
    // 5 consecutive days 10-14 days ago, then gap, then 1 catch today
    const longRun = Array.from({ length: 5 }, (_, i) => ev(`r${i}`, 10 + i));
    const recent = [ev('x', 0)];
    const best = bestStreak([...longRun, ...recent]);
    expect(best).toBe(5);
  });

  it('U-S-04 variant: bestStreak captures the longer sub-run', () => {
    // 3,4 days ago = 2-day run; 0 = 1-day run
    const events = [ev('a', 0), ev('b', 3), ev('c', 4)];
    expect(bestStreak(events)).toBe(2);
  });
});

describe('totalCatches', () => {
  it('returns 0 for empty log', () => {
    expect(totalCatches([])).toBe(0);
  });

  it('counts all events including duplicates', () => {
    const events = [ev('a', 0), ev('a', 0), ev('b', 1)];
    expect(totalCatches(events)).toBe(3);
  });
});

describe('calendarGrid', () => {
  it('returns correct number of cells', () => {
    const grid = calendarGrid([], 7);
    expect(grid).toHaveLength(7);
  });

  it('last cell is today (isToday=true)', () => {
    const grid = calendarGrid([], 7);
    expect(grid[grid.length - 1]!.isToday).toBe(true);
  });

  it('marks caught days correctly', () => {
    const events = [ev('a', 0), ev('b', 2)];
    const grid = calendarGrid(events, 7);
    const today = grid.find((c) => c.isToday)!;
    expect(today.caught).toBe(true);
    const twoDaysAgo = grid.find((c) => c.daysAgo === 2)!;
    expect(twoDaysAgo.caught).toBe(true);
    const oneDayAgo = grid.find((c) => c.daysAgo === 1)!;
    expect(oneDayAgo.caught).toBe(false);
  });

  it('returns cells ordered oldest first', () => {
    const grid = calendarGrid([], 5);
    for (let i = 0; i < grid.length - 1; i++) {
      expect(grid[i]!.daysAgo).toBeGreaterThan(grid[i + 1]!.daysAgo);
    }
  });
});

describe('recentBugIds', () => {
  it('returns empty array for empty log', () => {
    expect(recentBugIds([], 5)).toEqual([]);
  });

  it('deduplicates: re-catching same bug does not shift others out', () => {
    const events = [
      ev('a', 3),
      ev('b', 2),
      ev('a', 1), // re-catch of 'a' — newest
      ev('c', 0),
    ];
    const ids = recentBugIds(events, 3);
    // newest-first, distinct: c (0), a (1), b (2)
    expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('respects the limit', () => {
    const events = Array.from({ length: 10 }, (_, i) => ev(`bug${i}`, i));
    expect(recentBugIds(events, 3)).toHaveLength(3);
  });
});

describe('geotaggedCatches', () => {
  it('filters out catches without coordinates', () => {
    const events: CatchEvent[] = [
      { id: 'a', at: msAt(0), lat: 51.5, lng: -0.1 },
      { id: 'b', at: msAt(1) },
    ];
    const geo = geotaggedCatches(events);
    expect(geo).toHaveLength(1);
    expect(geo[0]!.id).toBe('a');
  });

  it('returns newest first', () => {
    const events: CatchEvent[] = [
      { id: 'old', at: msAt(5), lat: 1, lng: 1 },
      { id: 'new', at: msAt(0), lat: 2, lng: 2 },
    ];
    const geo = geotaggedCatches(events);
    expect(geo[0]!.id).toBe('new');
  });
});

describe('latestPhotoFor', () => {
  it('returns undefined if no photo exists for bug', () => {
    expect(latestPhotoFor([ev('a', 0)], 'a')).toBeUndefined();
  });

  it('returns the most recent photoUri for a given bug', () => {
    const events: CatchEvent[] = [
      { id: 'a', at: msAt(2), photoUri: 'file://old.jpg' },
      { id: 'a', at: msAt(0), photoUri: 'file://new.jpg' },
      { id: 'b', at: msAt(1), photoUri: 'file://other.jpg' },
    ];
    expect(latestPhotoFor(events, 'a')).toBe('file://new.jpg');
  });

  it('ignores catches for other bugs', () => {
    const events: CatchEvent[] = [
      { id: 'b', at: msAt(0), photoUri: 'file://other.jpg' },
    ];
    expect(latestPhotoFor(events, 'a')).toBeUndefined();
  });
});

describe('buildSeedCatchLog', () => {
  it('returns a non-empty array', () => {
    const log = buildSeedCatchLog();
    expect(log.length).toBeGreaterThan(0);
  });

  it('all events have valid id and at fields', () => {
    const log = buildSeedCatchLog();
    for (const e of log) {
      expect(typeof e.id).toBe('string');
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.at).toBe('number');
      expect(e.at).toBeGreaterThan(0);
    }
  });

  it('all events are in the past', () => {
    const now = Date.now();
    const log = buildSeedCatchLog(now);
    for (const e of log) {
      expect(e.at).toBeLessThanOrEqual(now);
    }
  });

  it('produces a positive best-streak for the seeded data', () => {
    // The seed pattern ends with two missed days so currentStreak may be 0,
    // but the historical best-streak is always > 0.
    const log = buildSeedCatchLog();
    expect(bestStreak(log)).toBeGreaterThan(0);
  });
});

describe('computeFreezeState', () => {
  it('returns empty spent set and 0 available for no events', () => {
    const state = computeFreezeState([]);
    expect(state.spent.size).toBe(0);
    expect(state.available).toBe(0);
  });

  it('earns a freeze after 7 consecutive caught days', () => {
    const events = Array.from({ length: 7 }, (_, i) => ev(`b${i}`, i));
    const state = computeFreezeState(events);
    expect(state.available).toBe(1);
  });
});
