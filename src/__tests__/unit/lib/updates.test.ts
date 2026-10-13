import { describe, expect, it } from 'vitest';

import manifestJson from '../../../../packs/manifest.json';
import { pendingUpdates, type UpdateManifest } from '@/lib/updates';

const manifest: UpdateManifest = {
  manifest: 1,
  packs: { 'eu-ce': { version: 14, url: 'https://x/eu-ce.json' }, 'na-ne': { version: 3, url: 'https://x/na-ne.json' } },
};

describe('pendingUpdates', () => {
  it('lists an installed pack with a newer version', () => {
    expect(pendingUpdates(manifest, { packs: { 'eu-ce': 13 } })).toEqual([
      { kind: 'pack', id: 'eu-ce', url: 'https://x/eu-ce.json', version: 14 },
    ]);
  });
  it('ignores packs that are current or not installed', () => {
    expect(pendingUpdates(manifest, { packs: { 'eu-ce': 14 } })).toEqual([]);
  });
  it('copes with no manifest', () => {
    expect(pendingUpdates(null, { packs: { 'eu-ce': 1 } })).toEqual([]);
  });
});

describe('packs/manifest.json', () => {
  it('no longer lists a chat model (chat runs on Apple Intelligence)', () => {
    expect('chat' in manifestJson).toBe(false);
  });
});
