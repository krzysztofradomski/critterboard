import { describe, expect, it } from 'vitest';

import { findBugByLatin, mergeBugs } from '@/data/bugs';
import { bugName } from '@/i18n/helpers';

describe('region-pack species', () => {
  mergeBugs([
    {
      id: 'pararge-aegeria', name: 'Speckled Wood', latin: 'Pararge aegeria',
      rarity: 'common', xp: 20, tier: '★', emoji: '🦋', color: '#e8903a',
      traits: ['butterfly', 'pollinator'],
    },
  ]);

  it('finds bundled and pack species by latin name', () => {
    expect(findBugByLatin('Apis mellifera')?.id).toBe('hcat');
    expect(findBugByLatin('Pararge aegeria')?.id).toBe('pararge-aegeria');
    expect(findBugByLatin('Nonexistent species')).toBeUndefined();
  });

  it('falls back to the pack name when a species has no translation', () => {
    expect(bugName('pl', 'pararge-aegeria')).toBe('Speckled Wood');
    expect(bugName('en', 'pararge-aegeria')).toBe('Speckled Wood');
  });

  it('keeps translated names for bundled species', () => {
    expect(bugName('en', 'hcat')).toBe('Honey Bee');
    expect(bugName('pl', 'hcat')).not.toBe('bugs.hcat.name');
  });
});
