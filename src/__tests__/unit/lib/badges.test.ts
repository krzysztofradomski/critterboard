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

import { BADGES } from '@/data/badges';
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
    for (const id of BADGES.map((b) => b.id)) {
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

  it('b5 (Photographer): 10 catches with a photo', () => {
    const withPhoto = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...ev('hcat', i), photoUri: 'file:///p.jpg' }));
    expect(isBadgeUnlocked('b5', withPhoto(9), emptyDex)).toBe(false);
    expect(isBadgeUnlocked('b5', withPhoto(10), emptyDex)).toBe(true);
    expect(isBadgeUnlocked('b5', Array.from({ length: 10 }, (_, i) => ev('hcat', i)), emptyDex)).toBe(false);
  });

  it('b7 (Early Bird): a catch between 04:00 and 07:59', () => {
    expect(isBadgeUnlocked('b7', [ev('hcat', 0, 5)], emptyDex)).toBe(true);
    expect(isBadgeUnlocked('b7', [ev('hcat', 0, 8)], emptyDex)).toBe(false);
    expect(isBadgeUnlocked('b7', [ev('hcat', 0, 3)], emptyDex)).toBe(false);
  });

  it('b8 (Legend Hunter) stays locked without a legendary species', () => {
    expect(isBadgeUnlocked('b8', [ev('hcat', 0)], new Set(['hcat', 'lady']))).toBe(false);
  });

  it('b9 / b10: distinct beetles and butterflies in the dex', () => {
    expect(isBadgeUnlocked('b9', empty, new Set(['lady', 'harl', 'stag', 'rchf']))).toBe(false);
    expect(isBadgeUnlocked('b10', empty, new Set(['brim', 'peac', 'lwhi', 'swhi', 'orng']))).toBe(true);
    expect(isBadgeUnlocked('b10', empty, new Set(['brim', 'peac', 'lwhi', 'swhi']))).toBe(false);
  });

  it('b11 / b12: dex size milestones', () => {
    const dexOf = (n: number) => new Set(Array.from({ length: n }, (_, i) => `x${i}`));
    expect(isBadgeUnlocked('b11', empty, dexOf(9))).toBe(false);
    expect(isBadgeUnlocked('b11', empty, dexOf(10))).toBe(true);
    expect(isBadgeUnlocked('b12', empty, dexOf(49))).toBe(false);
    expect(isBadgeUnlocked('b12', empty, dexOf(50))).toBe(true);
  });

  it('b13 / b14: streak milestones (7 and 30 days)', () => {
    const run = (n: number) => Array.from({ length: n }, (_, i) => ev('hcat', i));
    expect(isBadgeUnlocked('b13', run(6), emptyDex)).toBe(false);
    expect(isBadgeUnlocked('b13', run(7), emptyDex)).toBe(true);
    expect(isBadgeUnlocked('b14', run(29), emptyDex)).toBe(false);
    expect(isBadgeUnlocked('b14', run(30), emptyDex)).toBe(true);
  });

  it('b15 (Cartographer): 5 catches with coordinates', () => {
    const pinned = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...ev('hcat', i), lat: 50, lng: 19 }));
    expect(isBadgeUnlocked('b15', pinned(4), emptyDex)).toBe(false);
    expect(isBadgeUnlocked('b15', pinned(5), emptyDex)).toBe(true);
  });

  it('b16 (Triple Play): 3 catches on one day, not across days', () => {
    expect(isBadgeUnlocked('b16', [ev('a', 0, 9), ev('b', 0, 12), ev('c', 0, 15)], emptyDex)).toBe(true);
    expect(isBadgeUnlocked('b16', [ev('a', 0), ev('b', 1), ev('c', 2)], emptyDex)).toBe(false);
  });

  it('b17 (Rare Find): needs a rare-or-better species', () => {
    expect(isBadgeUnlocked('b17', empty, new Set(['hcat', 'lady']))).toBe(false);
    expect(isBadgeUnlocked('b17', empty, new Set(['swal']))).toBe(true);
  });

  it('U-B-06: re-evaluating same state is idempotent', () => {
    const log = [ev('hcat', 0)];
    const result1 = isBadgeUnlocked('b1', log, emptyDex);
    const result2 = isBadgeUnlocked('b1', log, emptyDex);
    expect(result1).toBe(result2);
  });
});
