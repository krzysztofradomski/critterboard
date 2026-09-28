import { describe, expect, it, vi } from 'vitest';

import { BUGS, allBugs, mergeBugs, subscribeBugs, type Bug } from '@/data/bugs';

const pack: Bug[] = [
  {
    id: 'arctia-caja', name: 'Garden Tiger', latin: 'Arctia caja', rarity: 'rare',
    xp: 90, tier: '★★★', emoji: '🦋', color: '#e8903a', traits: [],
  },
  {
    id: 'nigma-walckenaeri', name: 'Nigma walckenaeri', latin: 'Nigma walckenaeri',
    rarity: 'epic', xp: 150, tier: '★★★★', emoji: '🕷️', color: '#6b5a4a', traits: [],
  },
];

describe('species registry listing', () => {
  it('starts with the bundled species, in order', () => {
    expect(allBugs().slice(0, BUGS.length).map((b) => b.id)).toEqual(BUGS.map((b) => b.id));
  });

  it('lists pack species after a merge and notifies subscribers', () => {
    const before = allBugs();
    const listener = vi.fn();
    const unsubscribe = subscribeBugs(listener);

    mergeBugs(pack);

    const after = allBugs();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(after).not.toBe(before); // new snapshot, so React sees the change
    expect(after.map((b) => b.id)).toEqual(expect.arrayContaining(['arctia-caja', 'nigma-walckenaeri']));

    unsubscribe();
    mergeBugs(pack);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate species merged twice (boot re-hydration)', () => {
    mergeBugs(pack);
    mergeBugs(pack);
    const ids = allBugs().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
