import { describe, expect, it } from 'vitest';

import pack from '../../../../packs/eu-ce.json';
import manifest from '../../../../packs/manifest.json';
import { BUGS, type Bug } from '@/data/bugs';
import { RARITY_COLOR } from '@/tokens/pb';

const TRAITS = new Set(['pollinator', 'beetle', 'butterfly', 'wasp', 'damselfly', 'bug']);
const bugs = pack.bugs as Bug[];

describe('packs/eu-ce.json', () => {
  it('matches the manifest version', () => {
    expect(manifest.packs['eu-ce'].version).toBe(pack.version);
    expect(pack.modelVersion).toBe(pack.version);
  });

  it('has a labelMap covering exactly 0..N-1 with a bug for every label', () => {
    const idx = Object.values(pack.labelMap).sort((a, b) => a - b);
    expect(idx).toEqual(Array.from({ length: idx.length }, (_, i) => i));
    const latins = new Set(bugs.map((b) => b.latin));
    for (const latin of Object.keys(pack.labelMap)) expect(latins.has(latin)).toBe(true);
    expect(bugs).toHaveLength(idx.length);
  });

  it('has unique ids and valid rarity / traits', () => {
    expect(new Set(bugs.map((b) => b.id)).size).toBe(bugs.length);
    for (const b of bugs) {
      expect(Object.keys(RARITY_COLOR)).toContain(b.rarity);
      for (const t of b.traits) expect(TRAITS.has(t)).toBe(true);
      expect(b.name.length).toBeGreaterThan(0);
    }
  });

  it('keeps the ids of the bundled species so existing catches stay valid', () => {
    const byLatin = new Map(bugs.map((b) => [b.latin, b.id]));
    for (const b of BUGS) expect(byLatin.get(b.latin)).toBe(b.id);
  });
});
