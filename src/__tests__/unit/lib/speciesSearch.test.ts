import { describe, expect, it } from 'vitest';

import type { Bug } from '@/data/bugs';
import { fold, searchSpecies } from '@/lib/speciesSearch';

const bug = (id: string, name: string, latin: string, rarity: Bug['rarity'], pl?: string): Bug =>
  ({ id, name, latin, rarity, xp: 10, tier: '★', emoji: '🐞', color: '#000', traits: [], ...(pl ? { names: { pl } } : {}) }) as Bug;

const BUGS = [
  bug('harl', 'Harlequin Ladybird', 'Harmonia axyridis', 'common', 'Biedronka azjatycka'),
  bug('lady', 'Seven-spot Ladybird', 'Coccinella septempunctata', 'common', 'Biedronka siedmiokropka'),
  bug('lest', 'Emerald Damselfly', 'Lestes sponsa', 'rare', 'Pałątka pospolita'),
  bug('cali', 'Banded Demoiselle', 'Calopteryx splendens', 'uncommon', 'Świtezianka błyszcząca'),
  bug('roma', 'Rosalia Longicorn', 'Rosalia alpina', 'legendary'),
];
const pl = (b: Bug) => b.names?.pl ?? b.name;
const ids = (q: string, nameOf = pl) => searchSpecies(BUGS, q, nameOf).map((b) => b.id);

describe('fold', () => {
  it('lowercases and strips accents, including Polish ł and German ß', () => {
    expect(fold('Świtezianka Błyszcząca')).toBe('switezianka blyszczaca');
    expect(fold('Łątka')).toBe('latka');
    expect(fold('Weißling')).toBe('weissling');
    expect(fold('Mariquita Señora')).toBe('mariquita senora');
  });
});

describe('searchSpecies', () => {
  it('finds by the app-language name without accents', () => {
    expect(ids('switeziank')).toEqual(['cali']);
    expect(ids('palatka')).toEqual(['lest']);
  });
  it('finds by English and Latin names too', () => {
    expect(ids('ladybird')).toEqual(['harl', 'lady']);
    expect(ids('coccinella')).toEqual(['lady']);
    expect(ids('ROSALIA')).toEqual(['roma']);
  });
  it('ranks name starts, then word starts, then anything inside; then commoner first', () => {
    // "biedronka": both start with it (common, alphabetical); "lady" both have it as a word start.
    expect(ids('biedronka')).toEqual(['harl', 'lady']);
    // "spot" starts a word in "Seven-spot Ladybird" only.
    expect(ids('spot')).toEqual(['lady']);
    expect(ids('cinel')).toEqual(['lady']); // inside "Coccinella" only
  });
  it('returns nothing for an empty or blank query', () => {
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });
  it('falls back to the English name when there is no localized one', () => {
    expect(ids('longicorn')).toEqual(['roma']);
  });
});
