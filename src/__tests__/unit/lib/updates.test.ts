import { describe, expect, it } from 'vitest';

import { pendingUpdates, type UpdateManifest } from '@/lib/updates';

const chatV2 = { id: 'chat', name: 'Qwen3 1.7B', filename: 'Qwen3-1.7B-v2.gguf', url: 'https://x/v2.gguf', bytes: 10, sizeGb: 1.1, version: 2 };
const manifest: UpdateManifest = {
  manifest: 1,
  packs: { 'eu-ce': { version: 14, url: 'https://x/eu-ce.json' }, 'na-ne': { version: 3, url: 'https://x/na-ne.json' } },
  chat: chatV2,
};

describe('pendingUpdates', () => {
  it('lists an installed pack with a newer version', () => {
    expect(pendingUpdates(manifest, { packs: { 'eu-ce': 13 }, chat: null })).toEqual([
      { kind: 'pack', id: 'eu-ce', url: 'https://x/eu-ce.json', version: 14 },
    ]);
  });
  it('ignores packs that are current or not installed', () => {
    expect(pendingUpdates(manifest, { packs: { 'eu-ce': 14 }, chat: null })).toEqual([]);
  });
  it('lists a newer chat model only when one is downloaded', () => {
    expect(pendingUpdates(manifest, { packs: {}, chat: { version: 1 } })).toEqual([{ kind: 'chat', entry: chatV2 }]);
    expect(pendingUpdates(manifest, { packs: {}, chat: { version: 2 } })).toEqual([]);
    expect(pendingUpdates(manifest, { packs: {}, chat: null })).toEqual([]);
  });
  it('copes with no manifest, or one without a chat entry', () => {
    expect(pendingUpdates(null, { packs: { 'eu-ce': 1 }, chat: { version: 1 } })).toEqual([]);
    expect(pendingUpdates({ manifest: 1, packs: {} }, { packs: {}, chat: { version: 1 } })).toEqual([]);
  });
  it('skips a malformed chat entry rather than offering a broken download', () => {
    const bad = { ...manifest, chat: { ...chatV2, bytes: 0 } };
    expect(pendingUpdates(bad, { packs: {}, chat: { version: 1 } })).toEqual([]);
  });
});

import manifestJson from '../../../../packs/manifest.json';
import { isChatModelEntry } from '@/lib/updates';

describe('packs/manifest.json chat entry', () => {
  it('is a valid, pinned chat model entry', () => {
    expect(isChatModelEntry(manifestJson.chat)).toBe(true);
    expect(manifestJson.chat.url).toMatch(/\/resolve\/[0-9a-f]{40}\//); // a commit, never `main`
  });
});
