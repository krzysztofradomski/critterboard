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
    // A pack update may keep its model (e.g. v5 only added icons).
    expect(pack.modelVersion).toBeLessThanOrEqual(pack.version);
  });

  it('has an icon for every species the model knows, packed back to back in the atlas', () => {
    const icons = pack.icons as { url: string; index: Record<string, number[]> };
    const idOf = new Map(bugs.map((b) => [b.latin, b.id]));
    for (const latin of Object.keys(pack.labelMap)) expect(icons.index[idOf.get(latin)!]).toBeDefined();
    const ranges = Object.values(icons.index).sort((x, y) => x[0] - y[0]);
    let next = 0;
    for (const [offset = -1, length = 0] of ranges) {
      expect(offset).toBe(next);
      expect(length).toBeGreaterThan(0);
      next = offset + length;
    }
    expect(icons.url).toMatch(/^https:\/\//);
  });

  it('has a labelMap covering exactly 0..N-1 with a bug for every label', () => {
    const idx = Object.values(pack.labelMap).sort((a, b) => a - b);
    expect(idx).toEqual(Array.from({ length: idx.length }, (_, i) => i));
    const latins = new Set(bugs.map((b) => b.latin));
    for (const latin of Object.keys(pack.labelMap)) expect(latins.has(latin)).toBe(true);
    // Extra entries are allowed: species from older packs are kept so
    // earlier catches still resolve.
    expect(bugs.length).toBeGreaterThanOrEqual(idx.length);
  });

  it('names every species (English common name or its Latin name)', () => {
    for (const b of bugs) expect(b.name.trim().length).toBeGreaterThan(0);
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

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

describe('packs/eu-ce.json pinned checksums', () => {
  // The app discards a download that doesn't match; a stale pin would break every install.
  // Re-pin with: python3 tools/packs/pin_checksums.py
  const local = (url: string) => readFileSync(url.replace(/^.*\/critterboard\/main\//, ''));
  const icons = pack.icons as { url: string; bytes: number; md5: string };
  it.each([
    ['model', pack.modelUrl, pack.modelBytes, pack.modelMd5],
    ['map', pack.mapUrl, pack.mapBytes, pack.mapMd5],
    ['icons', icons.url, icons.bytes, icons.md5],
  ])('%s matches the committed file', (_name, url, bytes, md5) => {
    const file = local(url);
    expect(file.length).toBe(bytes);
    expect(createHash('md5').update(file).digest('hex')).toBe(md5);
  });
});
