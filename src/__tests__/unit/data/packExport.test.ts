import { describe, expect, it, vi } from 'vitest';

// export.ts imports the legacy file-system API, which the shared setup
// doesn't mock (the real one pulls in react-native).
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: null }));

import { allBugs, mergeBugs, type Bug } from '@/data/bugs';
import { buildDexJson } from '@/lib/export';

const PACK: Bug[] = Array.from({ length: 40 }, (_, i) => ({
  id: `pack-${i}`, name: `Pack Moth ${i}`, latin: `Packus mothus${i}`, rarity: 'epic',
  xp: 150, tier: '★★★★', emoji: '🦋', color: '#e8903a', traits: [],
}));
mergeBugs(PACK);

describe('dex export', () => {
  it('includes pack species in species list and total', () => {
    const blob = buildDexJson(new Set(['pack-5']), [], 'en', 'Tester', 0);
    const payload = JSON.parse(blob.body);
    expect(payload.total).toBe(allBugs().length);
    expect(payload.species.find((s: { id: string }) => s.id === 'pack-5').caught).toBe(true);
  });
});
