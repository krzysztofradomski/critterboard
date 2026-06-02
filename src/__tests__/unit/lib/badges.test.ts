import { vi, describe, it, expect } from 'vitest';

// badges.ts transitively imports useAppStore (via streak.ts hooks).
// Mock the store to break the circular import and keep tests pure.
vi.mock('@/store/useAppStore', () => ({
  useAppStore: Object.assign(() => undefined, {
    getState: () => ({ catchLog: [], dex: new Set() }),
    setState: () => {},
    subscribe: () => () => {},
  }),
}));

import { isBadgeUnlocked } from '@/lib/badges';
import type { CatchEvent } from '@/lib/streak';

function ev(id: string, daysAgo: number, hours = 12): CatchEvent {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, 0, 0, 0);
  return { id, at: d.getTime() };
}

describe('isBadgeUnlocked (U-B-*)', () => {
  const empty: CatchEvent[] = [];
  const emptyDex = new Set<string>();

  it('U-B-01: no catches → no badges unlocked', () => {
    for (const id of ['b1', 'b2', 'b3', 'b4', 'b6']) {
      expect(isBadgeUnlocked(id, empty, emptyDex)).toBe(false);
    }
  });

  it('U-B-02: one catch → b1 (First Catch) unlocked', () => {
    expect(isBadgeUnlocked('b1', [ev('hcat', 0)], emptyDex)).toBe(true);
  });

  it('b1 stays false with empty log', () => {
    expect(isBadgeUnlocked('b1', [], emptyDex)).toBe(false);
  });

  it('U-B-04: bestStreak ≥ 3 → b2 unlocked', () => {
    const events = [ev('a', 0), ev('b', 1), ev('c', 2)];
    expect(isBadgeUnlocked('b2', events, emptyDex)).toBe(true);
  });

  it('bestStreak 2 → b2 not unlocked', () => {
    const events = [ev('a', 0), ev('b', 1)];
    expect(isBadgeUnlocked('b2', events, emptyDex)).toBe(false);
  });

  it('b3 (Night Owl): catch between 21:00–24:00 unlocks it', () => {
    const lateNight = ev('hcat', 0, 22); // 22:00 hours
    expect(isBadgeUnlocked('b3', [lateNight], emptyDex)).toBe(true);
  });

  it('b3 (Night Owl): catch between 00:00–03:59 unlocks it', () => {
    const earlyMorning = ev('hcat', 0, 3); // 03:00 hours
    expect(isBadgeUnlocked('b3', [earlyMorning], emptyDex)).toBe(true);
  });

  it('b3 (Night Owl): midday catch does not unlock it', () => {
    const midday = ev('hcat', 0, 12);
    expect(isBadgeUnlocked('b3', [midday], emptyDex)).toBe(false);
  });

  it('U-B-03: b4 (Pollinator Pal) requires 10 distinct pollinator species in dex', () => {
    // Pollinators from data/bugs: hcat, buff, gbee, wasp, lady, rchf, brim, peac, lwhi, swhi, orng, radm, tort, pntl, swal
    const pollinators = ['hcat', 'buff', 'gbee', 'wasp', 'lady', 'rchf', 'brim', 'peac', 'lwhi', 'swhi'];
    const dex = new Set(pollinators);
    expect(isBadgeUnlocked('b4', empty, dex)).toBe(true);
  });

  it('b4 not unlocked with fewer than 10 pollinator species', () => {
    const dex = new Set(['hcat', 'buff', 'gbee']);
    expect(isBadgeUnlocked('b4', empty, dex)).toBe(false);
  });

  it('b4 only counts pollinator-trait bugs (not all bugs in dex)', () => {
    // Mix of pollinator and non-pollinator species — only 9 pollinators
    const dex = new Set(['hcat', 'buff', 'gbee', 'wasp', 'lady', 'rchf', 'brim', 'peac', 'lwhi', 'stag']);
    // stag is a beetle (no pollinator), so only 9 pollinators → not enough
    expect(isBadgeUnlocked('b4', empty, dex)).toBe(false);
  });

  it('U-B-06: b6 (Centurion) requires ≥ 100 total catches', () => {
    const manyEvents = Array.from({ length: 100 }, (_, i) => ev('hcat', i % 30));
    expect(isBadgeUnlocked('b6', manyEvents, emptyDex)).toBe(true);
  });

  it('b6 not unlocked with 99 catches', () => {
    const almostThere = Array.from({ length: 99 }, (_, i) => ev('hcat', i % 30));
    expect(isBadgeUnlocked('b6', almostThere, emptyDex)).toBe(false);
  });

  it('U-B-05/U-B-07: b5/b7/b8 always return false (no derivation rule)', () => {
    const richLog = Array.from({ length: 200 }, (_, i) => ev('hcat', i % 30));
    const richDex = new Set(['hcat', 'buff', 'gbee']);
    for (const id of ['b5', 'b7', 'b8']) {
      expect(isBadgeUnlocked(id, richLog, richDex)).toBe(false);
    }
  });

  it('U-B-06: re-evaluating same state is idempotent', () => {
    const log = [ev('hcat', 0)];
    const result1 = isBadgeUnlocked('b1', log, emptyDex);
    const result2 = isBadgeUnlocked('b1', log, emptyDex);
    expect(result1).toBe(result2);
  });
});
