import { describe, expect, it } from 'vitest';

import type { Bug } from '@/data/bugs';
import {
  aboutText, badges, factTiles, formatSize, gardenRole, lifeCycle, orderKey, peakMonths, safety, seasonLevels, sizeComparison,
} from '@/data/speciesFacts';
import { t as translate } from '@/i18n';

const bug = (facts: Bug['facts'], latin = 'Xus ya', traits: Bug['traits'] = []): Bug => ({
  id: 'x', name: 'X', latin, rarity: 'rare', xp: 1, tier: '★★★', emoji: '🪲', color: '#000', traits, facts,
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

describe('order, badges and garden role', () => {
  it('names the order in plain words, or nothing without one', () => {
    expect(orderKey(bug({ o: 'Lepidoptera' }))).toBe('facts.order.Lepidoptera');
    expect(orderKey(bug({}))).toBeNull();
  });

  it('a ladybird hunts aphids and is a garden friend', () => {
    const b = bug({ o: 'Coleoptera', fa: 'Coccinellidae', d: 'aphid_eaters' }, 'Coccinella septempunctata', ['beetle', 'pollinator']);
    expect(badges(b)).toEqual(['pollinator', 'aphidHunter']);
    expect(gardenRole(b)).toBe('friend');
  });

  it('a pest stays a pest even when it pollinates', () => {
    expect(gardenRole(bug({ o: 'Lepidoptera', d: 'lepi' }, 'Pieris rapae', ['butterfly', 'pollinator']))).toBe('pest');
    expect(gardenRole(bug({ o: 'Hemiptera', d: 'sap' }, 'Aphis fabae'))).toBe('pest');
  });

  it('a recycler alone is neither friend nor pest', () => {
    const b = bug({ o: 'Blattodea', d: 'detritus' }, 'Ectobius sylvestris');
    expect(badges(b)).toEqual(['recycler']);
    expect(gardenRole(b)).toBeNull();
  });
});

describe('safety', () => {
  it('follows family and genus', () => {
    expect(safety(bug({ o: 'Hymenoptera', fa: 'Vespidae' }, 'Vespula vulgaris'))).toBe('sting');
    expect(safety(bug({ o: 'Hymenoptera', fa: 'Formicidae' }, 'Lasius niger'))).toBe('bite');
    expect(safety(bug({ o: 'Hymenoptera', fa: 'Formicidae' }, 'Myrmica rubra'))).toBe('sting');
    expect(safety(bug({ o: 'Ixodida', fa: 'Ixodidae' }, 'Ixodes ricinus'))).toBe('tick');
    expect(safety(bug({ o: 'Lepidoptera', fa: 'Notodontidae' }, 'Thaumetopoea processionea'))).toBe('irritant');
    expect(safety(bug({ o: 'Coleoptera', fa: 'Meloidae' }, 'Meloe violaceus'))).toBe('irritant');
    expect(safety(bug({ o: 'Lepidoptera', fa: 'Nymphalidae' }, 'Aglais io'))).toBe('harmless');
  });

  it('says nothing when the order is unknown', () => {
    expect(safety(bug(undefined))).toBeNull();
  });
});

describe('lifeCycle', () => {
  it('butterflies go through a caterpillar and a pupa', () => {
    expect(lifeCycle(bug({ o: 'Lepidoptera' }))).toEqual({ kind: 'complete', stages: ['egg', 'caterpillar', 'pupa', 'adult'] });
  });

  it('dragonflies grow up in water without a pupa', () => {
    expect(lifeCycle(bug({ o: 'Odonata' }))).toEqual({ kind: 'incomplete', stages: ['egg', 'nymphWater', 'adult'] });
  });

  it('spiders hatch as small adults; ticks pass a larva and a nymph', () => {
    expect(lifeCycle(bug({ o: 'Araneae' }))!.kind).toBe('direct');
    expect(lifeCycle(bug({ o: 'Ixodida' }))!.stages).toEqual(['egg', 'larva', 'nymph', 'adult']);
  });

  it('is null for an unknown order', () => {
    expect(lifeCycle(bug({ o: 'Strepsiptera' }))).toBeNull();
  });
});

describe('sizeComparison', () => {
  it('picks the object closest by ratio', () => {
    expect(sizeComparison(bug({ sz: [63, 69] }))!.ref).toBe('card');
    expect(sizeComparison(bug({ sz: [45, 55] }))!.ref).toBe('matchbox');
    expect(sizeComparison(bug({ sz: [5, 8] }))!.ref).toBe('rice');
    expect(sizeComparison(bug({ sz: [1.5, 2] }))!.ref).toBe('sesame');
    expect(sizeComparison(bug({}))).toBeNull();
  });
});

describe('season', () => {
  it('decodes the 12 digits and rejects anything else', () => {
    expect(seasonLevels(bug({ m: '001369963100' }))).toEqual([0, 0, 1, 3, 6, 9, 9, 6, 3, 1, 0, 0]);
    expect(seasonLevels(bug({ m: '123' }))).toBeNull();
  });

  it('finds the busiest run of months', () => {
    expect(peakMonths([0, 0, 1, 3, 6, 9, 9, 6, 3, 1, 0, 0])).toEqual([4, 7]);
  });

  it('wraps over New Year for winter species', () => {
    expect(peakMonths([9, 7, 2, 0, 0, 0, 0, 0, 0, 1, 5, 8])).toEqual([10, 1]);
  });

  it('is null when no month stands out', () => {
    expect(peakMonths(Array(12).fill(0))).toBeNull();
  });
});

describe('aboutText', () => {
  it('uses the UI language only', () => {
    const b = bug({ ab: { en: 'A butterfly.', pl: 'Motyl.' } });
    expect(aboutText(b, 'pl')).toBe('Motyl.');
    expect(aboutText(b, 'de')).toBeNull();
  });
});
