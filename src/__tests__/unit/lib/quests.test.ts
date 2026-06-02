import { describe, it, expect } from 'vitest';
import {
  rarityIndex,
  catchSatisfiesRule,
  questsAdvancedBy,
  claimStateOf,
} from '@/lib/quests';
import { QUEST_RULES } from '@/data/quests';

describe('rarityIndex', () => {
  it('common is the lowest (0)', () => {
    expect(rarityIndex('common')).toBe(0);
  });

  it('legendary is the highest (4)', () => {
    expect(rarityIndex('legendary')).toBe(4);
  });

  it('ordering: common < uncommon < rare < epic < legendary', () => {
    expect(rarityIndex('common')).toBeLessThan(rarityIndex('uncommon'));
    expect(rarityIndex('uncommon')).toBeLessThan(rarityIndex('rare'));
    expect(rarityIndex('rare')).toBeLessThan(rarityIndex('epic'));
    expect(rarityIndex('epic')).toBeLessThan(rarityIndex('legendary'));
  });
});

describe('catchSatisfiesRule (U-Q-*)', () => {
  it('trait rule matches a bug with the correct trait', () => {
    // q1: pollinator; hcat (Honey Bee) is a pollinator
    const rule = QUEST_RULES['q1']!;
    expect(catchSatisfiesRule(rule, 'hcat')).toBe(true);
  });

  it('trait rule does not match a bug without the trait', () => {
    // q2: beetle; hcat is not a beetle
    const rule = QUEST_RULES['q2']!;
    expect(catchSatisfiesRule(rule, 'hcat')).toBe(false);
  });

  it('bug with multiple traits satisfies multiple rules', () => {
    // lady (Seven-spot Ladybird) has traits: beetle + pollinator
    const pollinatorRule = QUEST_RULES['q1']!;
    const beetleRule = QUEST_RULES['q2']!;
    expect(catchSatisfiesRule(pollinatorRule, 'lady')).toBe(true);
    expect(catchSatisfiesRule(beetleRule, 'lady')).toBe(true);
  });

  it('U-Q-06: rarity rule only matches bugs at-or-above the required rarity', () => {
    // q3: legendary; stag is only rare — should NOT satisfy
    const rule = QUEST_RULES['q3']!;
    expect(catchSatisfiesRule(rule, 'stag')).toBe(false);
  });

  it('streak rule never satisfies on individual catch', () => {
    // q4: streak; no individual catch can satisfy this
    const rule = QUEST_RULES['q4']!;
    expect(catchSatisfiesRule(rule, 'hcat')).toBe(false);
  });

  it('returns false for an unknown bug id', () => {
    const rule = QUEST_RULES['q1']!;
    expect(catchSatisfiesRule(rule, 'does-not-exist')).toBe(false);
  });
});

describe('questsAdvancedBy (U-Q-*)', () => {
  it('U-Q-01: empty progress — catching a pollinator advances q1', () => {
    const advanced = questsAdvancedBy('hcat', {});
    expect(advanced).toContain('q1');
  });

  it('U-Q-02: pollinator catch advances q1 but not q2', () => {
    const advanced = questsAdvancedBy('hcat', {});
    expect(advanced).toContain('q1');
    expect(advanced).not.toContain('q2');
    expect(advanced).not.toContain('q3');
    expect(advanced).not.toContain('q4');
  });

  it('U-Q-03: beetle+pollinator bug advances both q1 and q2', () => {
    // lady: traits = ['beetle', 'pollinator']
    const advanced = questsAdvancedBy('lady', {});
    expect(advanced).toContain('q1');
    expect(advanced).toContain('q2');
  });

  it('skips quests already at completion', () => {
    // q1 total = 3; if progress is 3, it should not be advanced
    const advanced = questsAdvancedBy('hcat', { q1: 3 });
    expect(advanced).not.toContain('q1');
  });

  it('uses stored progress over template default', () => {
    // q2 total=1; if stored progress is already 1, skip
    const advanced = questsAdvancedBy('lady', { q2: 1 });
    expect(advanced).not.toContain('q2');
  });
});

describe('claimStateOf (U-Q-07)', () => {
  it('returns "unready" when progress < total', () => {
    expect(claimStateOf('q1', 2, 3, {})).toBe('unready');
  });

  it('returns "claimable" when progress >= total and not yet claimed', () => {
    expect(claimStateOf('q1', 3, 3, {})).toBe('claimable');
    expect(claimStateOf('q1', 5, 3, {})).toBe('claimable'); // over-progress
  });

  it('returns "claimed" when quest is already in claimed record', () => {
    expect(claimStateOf('q1', 3, 3, { q1: 1234567890 })).toBe('claimed');
  });

  it('"claimed" takes priority over progress state', () => {
    // Even if progress < total, if claimed exists it shows claimed
    expect(claimStateOf('q1', 0, 3, { q1: 1234567890 })).toBe('claimed');
  });
});
