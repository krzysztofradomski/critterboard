import { describe, it, expect } from 'vitest';

import { BUGS, mergeBugs } from '@/data/bugs';
import {
  xpFromDex,
  xpFromClaimedQuests,
  levelFromXp,
  xpToReach,
  formatXp,
  rankFromXp,
  maxXp,
} from '@/lib/level';

// Level thresholds: 300 × (L-1)^1.7, rounded to 10
// L1=0, L2=300, L3=970, L4=1940, L5=3170

describe('levelFromXp (U-L-*)', () => {
  it('U-L-01: 0 XP → level 1', () => {
    const info = levelFromXp(0);
    expect(info.level).toBe(1);
    expect(info.xp).toBe(0);
    expect(info.into).toBe(0);
    expect(info.nextAt).toBe(300);
  });

  it('U-L-02: exact threshold XP → level up', () => {
    // 300 XP → exactly level 2
    const info = levelFromXp(300);
    expect(info.level).toBe(2);
    expect(info.into).toBe(0); // no progress into level 3
    expect(info.nextAt).toBe(970);
  });

  it('U-L-03: XP just below threshold stays at same level', () => {
    // 299 XP → still level 1
    const info = levelFromXp(299);
    expect(info.level).toBe(1);
  });

  it('U-L-04: large XP → correct high level', () => {
    // 50000 XP is past the L21 threshold (48,850) and short of L22
    const info = levelFromXp(50000);
    expect(info.level).toBe(21);
  });

  it('U-L-05: into and span produce a progress ratio in [0, 1]', () => {
    for (const xp of [0, 50, 299, 300, 969, 970, 1000, 9999]) {
      const info = levelFromXp(xp);
      const ratio = info.into / info.span;
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  it('negative XP is treated as 0', () => {
    const info = levelFromXp(-100);
    expect(info.level).toBe(1);
    expect(info.xp).toBe(0);
  });

  it('span equals nextAt - prevAt', () => {
    const info = levelFromXp(250);
    expect(info.span).toBe(info.nextAt - xpToReach(info.level));
  });
});

describe('xpFromDex (U-L-*)', () => {
  it('returns 0 for empty dex', () => {
    expect(xpFromDex(new Set())).toBe(0);
  });

  it('sums XP for known bug ids', () => {
    // hcat = 15 XP, buff = 20 XP
    const xp = xpFromDex(new Set(['hcat', 'buff']));
    expect(xp).toBe(35);
  });

  it('silently skips unknown bug ids', () => {
    const xp = xpFromDex(new Set(['hcat', 'nonexistent_id']));
    expect(xp).toBe(15); // only hcat counts
  });
});

describe('xpFromClaimedQuests', () => {
  it('returns 0 for empty claimed record', () => {
    expect(xpFromClaimedQuests({})).toBe(0);
  });

  it('sums rewards for known quest ids', () => {
    // q1 reward = 75, q2 reward = 40
    const xp = xpFromClaimedQuests({ q1: 1000, q2: 2000 });
    expect(xp).toBe(115);
  });

  it('silently skips unknown quest ids', () => {
    const xp = xpFromClaimedQuests({ q1: 1000, 'ghost-quest': 9999 });
    expect(xp).toBe(75);
  });
});

describe('maxXp', () => {
  it('is the sum of all known species XP values', () => {
    expect(maxXp()).toBe(BUGS.reduce((sum, b) => sum + b.xp, 0));
  });

  it('grows when a region pack adds species', () => {
    const before = maxXp();
    mergeBugs([{ id: 'xp-test', name: 'XP Test', latin: 'Xp testus', rarity: 'epic', xp: 150, tier: '★★★★', emoji: '🐛', color: '#000', traits: [] }]);
    expect(maxXp()).toBe(before + 150);
  });
});

describe('formatXp', () => {
  it('formats values under 1000 as plain integers', () => {
    expect(formatXp(0)).toBe('0');
    expect(formatXp(342)).toBe('342');
    expect(formatXp(999)).toBe('999');
  });

  it('formats 1000–9999 as X.Xk', () => {
    expect(formatXp(1000)).toBe('1.0k');
    expect(formatXp(1200)).toBe('1.2k');
    expect(formatXp(9999)).toBe('10.0k');
  });

  it('formats 10000–99999 as XX.Xk', () => {
    expect(formatXp(10000)).toBe('10.0k');
    expect(formatXp(24600)).toBe('24.6k');
  });

  it('formats 100000+ as XXXk (no decimal)', () => {
    expect(formatXp(120000)).toBe('120k');
    expect(formatXp(1000000)).toBe('1000k');
  });
});

describe('rankFromXp', () => {
  it('returns at least 1', () => {
    expect(rankFromXp(0)).toBeGreaterThanOrEqual(1);
  });

  it('very high XP gives rank 1', () => {
    expect(rankFromXp(Number.MAX_SAFE_INTEGER)).toBe(1);
  });

  it('rank increases when XP is very low', () => {
    const rankLow = rankFromXp(0);
    const rankHigh = rankFromXp(10000);
    expect(rankHigh).toBeLessThanOrEqual(rankLow);
  });
});
