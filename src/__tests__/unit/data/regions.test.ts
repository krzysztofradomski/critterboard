import { describe, expect, it } from 'vitest';

import { AVAILABLE_REGION_IDS, REGIONS } from '@/data/regions';
import manifest from '../../../../packs/manifest.json';

describe('available regions', () => {
  it('match the packs listed in packs/manifest.json', () => {
    expect([...AVAILABLE_REGION_IDS].sort()).toEqual(Object.keys(manifest.packs).sort());
  });

  it('are all known regions', () => {
    const known = new Set(REGIONS.map((r) => r.id));
    for (const id of AVAILABLE_REGION_IDS) expect(known.has(id)).toBe(true);
  });
});
