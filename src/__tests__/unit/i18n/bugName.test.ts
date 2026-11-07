import { describe, expect, it } from 'vitest';

import pack from '../../../../packs/eu-ce.json';
import { mergeBugs, type Bug } from '@/data/bugs';
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

describe('reviewed common names in the Central Europe pack', () => {
  const examples = [
    ['pl', 'tipula-oleracea', 'Koziułka warzywna'],
    ['pl', 'chrysoperla-carnea', 'Złotook drapieżny'],
    ['de', 'tipula-oleracea', 'Kohlschnake'],
    ['de', 'chrysoperla-carnea', 'Gemeine Florfliege'],
    ['es', 'chrysoperla-carnea', 'Crisopa'],
    ['es', 'musca-domestica', 'Mosca doméstica'],
    ['pl', 'andrena-flavipes', 'Pszczolinka pospolita'],
    ['pl', 'leptidea-sinapis', 'Wietek gorczycznik'],
    ['de', 'macrosiphum-rosae', 'Große Rosenblattlaus'],
    ['es', 'tyria-jacobaeae', 'Polilla cinabrio'],
  ] as const;
  const ids = new Set<string>(examples.map(([, id]) => id));
  mergeBugs((pack.bugs as Bug[]).filter((bug) => ids.has(bug.id)));

  it.each(examples)('displays the %s name for %s', (lang, id, name) => {
    expect(bugName(lang, id)).toBe(name);
  });
});
