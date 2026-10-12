import { describe, expect, it } from 'vitest';

import pack from '../../../../packs/eu-ce.json';
import { SPECIES_XP } from '../../../../worker/src/speciesXp';

// The worker scores leaderboard XP (and validates training uploads) from its own copy of the
// species list. A pack species missing there earns 0 XP: regenerate with
// `python3 tools/worker/gen_species_xp.py` whenever a pack adds species.
describe('worker/src/speciesXp.ts', () => {
  it('has every region-pack species, with the same XP', () => {
    const missing = pack.bugs.filter((b) => SPECIES_XP[b.id] === undefined).map((b) => b.id);
    expect(missing).toEqual([]);
    for (const b of pack.bugs) expect(SPECIES_XP[b.id]).toBe(b.xp);
  });
});
