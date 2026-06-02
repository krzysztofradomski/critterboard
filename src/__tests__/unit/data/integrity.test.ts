import { describe, it, expect } from 'vitest';
import { BUGS, findBug, type Bug } from '@/data/bugs';
import { QUESTS, QUEST_RULES } from '@/data/quests';
import { BADGES } from '@/data/badges';

const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const VALID_TRAITS = new Set(['pollinator', 'beetle', 'butterfly', 'wasp', 'damselfly', 'bug']);

describe('data/bugs.ts integrity (U-DA-01 – U-DA-03)', () => {
  it('U-DA-01: every bug has id, name, emoji, rarity, and xp', () => {
    for (const bug of BUGS) {
      expect(typeof bug.id).toBe('string');
      expect(bug.id.length).toBeGreaterThan(0);
      expect(typeof bug.name).toBe('string');
      expect(bug.name.length).toBeGreaterThan(0);
      expect(typeof bug.emoji).toBe('string');
      expect(bug.emoji.length).toBeGreaterThan(0);
      expect(typeof bug.rarity).toBe('string');
      expect(typeof bug.xp).toBe('number');
      expect(bug.xp).toBeGreaterThan(0);
    }
  });

  it('U-DA-02: bug IDs are unique', () => {
    const ids = BUGS.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('U-DA-03: all rarity values are valid enum members', () => {
    for (const bug of BUGS) {
      expect(VALID_RARITIES.has(bug.rarity)).toBe(true);
    }
  });

  it('all trait values are valid BugTrait members', () => {
    for (const bug of BUGS) {
      for (const trait of bug.traits) {
        expect(VALID_TRAITS.has(trait)).toBe(true);
      }
    }
  });

  it('all bugs have a latin (scientific) name', () => {
    for (const bug of BUGS) {
      expect(typeof bug.latin).toBe('string');
      expect(bug.latin.length).toBeGreaterThan(0);
    }
  });

  it('findBug returns the correct bug for a known id', () => {
    const hcat = findBug('hcat');
    expect(hcat).toBeDefined();
    expect(hcat?.name).toBe('Honey Bee');
  });

  it('findBug returns undefined for an unknown id', () => {
    expect(findBug('does-not-exist')).toBeUndefined();
  });

  it('BUGS catalog is non-empty', () => {
    expect(BUGS.length).toBeGreaterThan(0);
  });
});

describe('data/quests.ts integrity (U-DA-04 – U-DA-05)', () => {
  it('U-DA-05: quest IDs are unique', () => {
    const ids = QUESTS.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all quests have a positive reward', () => {
    for (const q of QUESTS) {
      expect(q.reward).toBeGreaterThan(0);
    }
  });

  it('all quests have total > 0', () => {
    for (const q of QUESTS) {
      expect(q.total).toBeGreaterThan(0);
    }
  });

  it('quest kind is "daily" or "weekly"', () => {
    for (const q of QUESTS) {
      expect(['daily', 'weekly']).toContain(q.kind);
    }
  });

  it('U-DA-04: every quest rule references a valid filter kind', () => {
    for (const [id, rule] of Object.entries(QUEST_RULES)) {
      expect(['trait', 'rarity', 'streak']).toContain(rule.kind);
      if (rule.kind === 'trait') {
        expect(VALID_TRAITS.has(rule.trait)).toBe(true);
      }
      if (rule.kind === 'rarity') {
        expect(VALID_RARITIES.has(rule.rarity)).toBe(true);
      }
    }
  });

  it('progress is non-negative and ≤ total for all seed quests', () => {
    for (const q of QUESTS) {
      expect(q.progress).toBeGreaterThanOrEqual(0);
      expect(q.progress).toBeLessThanOrEqual(q.total);
    }
  });
});

describe('data/badges.ts integrity (U-DA-06)', () => {
  it('all badge ids are unique', () => {
    const ids = BADGES.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all badges have an icon and color', () => {
    for (const badge of BADGES) {
      expect(typeof badge.icon).toBe('string');
      expect(badge.icon.length).toBeGreaterThan(0);
      expect(typeof badge.color).toBe('string');
      expect(badge.color.length).toBeGreaterThan(0);
    }
  });

  it('unlocked field is a boolean', () => {
    for (const badge of BADGES) {
      expect(typeof badge.unlocked).toBe('boolean');
    }
  });

  it('BADGES list is non-empty', () => {
    expect(BADGES.length).toBeGreaterThan(0);
  });
});
