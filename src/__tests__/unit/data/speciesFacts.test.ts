import { describe, expect, it } from 'vitest';

import type { Bug } from '@/data/bugs';
import { factTiles, formatSize } from '@/data/speciesFacts';
import { t as translate } from '@/i18n';

const bug = (facts: Bug['facts']): Bug => ({
  id: 'x', name: 'X', latin: 'Xus ya', rarity: 'rare', xp: 1, tier: '★★★', emoji: '🪲', color: '#000', traits: [], facts,
});

describe('formatSize', () => {
  it('uses mm below 3 cm and cm above, with a decimal comma outside English', () => {
    expect(formatSize([24, 28], 'en')).toBe('24–28 mm');
    expect(formatSize([35, 42], 'en')).toBe('3.5–4.2 cm');
    expect(formatSize([35, 42], 'pl')).toBe('3,5–4,2 cm');
    expect(formatSize([7, 7], 'en')).toBe('7 mm');
  });
});

describe('factTiles', () => {
  const t = (lang: 'en' | 'pl') => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

  it('is null for species without facts', () => {
    expect(factTiles(bug(undefined), 'en', t('en'))).toBeNull();
  });

  it('builds habitat, size, range and diet tiles in the UI language', () => {
    const tiles = factTiles(bug({ fa: 'Nymphalidae', h: 'flowery', d: 'lepi', sz: [60, 70], k: 'w', r: ['EUROPE', 'ASIA'] }), 'pl', t('pl'))!;
    expect(tiles[0]!.label).toBe('Siedlisko');
    expect(tiles[1]!.label).toBe('Rozpiętość');
    expect(tiles[1]!.value).toBe('6–7 cm');
    expect(tiles[2]!.value).toBe('Europa, Azja');
  });

  it('shows the family when no size is known', () => {
    const tiles = factTiles(bug({ fa: 'Noctuidae', h: 'flowery', d: 'lepi' }), 'en', t('en'))!;
    expect(tiles[1]).toMatchObject({ label: 'Family', value: 'Noctuidae' });
  });
});
