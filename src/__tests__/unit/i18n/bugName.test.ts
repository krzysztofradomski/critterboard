import { describe, expect, it } from 'vitest';

import { mergeBugs } from '@/data/bugs';
import { bugName } from '@/i18n/helpers';

describe('bugName for pack species', () => {
  mergeBugs([
    {
      id: 'zz-test', name: 'Test Beetle', latin: 'Testus beetlus', rarity: 'rare', xp: 1,
      tier: '★★★', emoji: '🪲', color: '#000', traits: [], names: { pl: 'Chrząszcz testowy' },
    },
  ]);

  it('uses the pack name for the UI language', () => {
    expect(bugName('pl', 'zz-test')).toBe('Chrząszcz testowy');
  });
  it('falls back to English when a language has no name', () => {
    expect(bugName('de', 'zz-test')).toBe('Test Beetle');
    expect(bugName('en', 'zz-test')).toBe('Test Beetle');
  });
});
