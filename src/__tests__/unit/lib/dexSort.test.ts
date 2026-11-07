import { describe, expect, it } from 'vitest';

import { sortDexEntries } from '@/lib/dexSort';

const entries = ['unknown1', 'first', 'undated', 'latest', 'unknown2', 'tied', 'alsoUndated']
  .map((id) => ({ id }));
const caught = new Set(['first', 'latest', 'tied', 'undated', 'alsoUndated']);

describe('sortDexEntries', () => {
  it('orders by first capture, even with repeat catches and an out-of-order log', () => {
    const events = [
      { id: 'first', at: 400 },
      { id: 'latest', at: 200 },
      { id: 'first', at: 100 },
      { id: 'tied', at: 200 },
      { id: 'unknown1', at: 500 },
    ];
    const sorted = sortDexEntries(entries, caught, events, 'date', 'en', (id) => id);

    expect(sorted.map(({ id }) => id)).toEqual([
      'latest', 'tied', 'first', 'undated', 'alsoUndated', 'unknown1', 'unknown2',
    ]);
    expect(entries[0]?.id).toBe('unknown1');
  });

  it('uses the displayed names and app language only for caught entries', () => {
    const names: Record<string, string> = {
      first: 'Łątka',
      latest: 'Lis',
      tied: 'Lis',
      undated: 'Mrówka',
      alsoUndated: 'Aksamitka',
    };
    const sorted = sortDexEntries(entries, caught, [], 'name', 'pl', (id) => {
      expect(names[id]).toBeDefined();
      return names[id]!;
    });

    expect(sorted.map(({ id }) => id)).toEqual([
      'alsoUndated', 'latest', 'tied', 'first', 'undated', 'unknown1', 'unknown2',
    ]);
  });
});
