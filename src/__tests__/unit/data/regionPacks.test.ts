import { vi, describe, it, expect, beforeEach } from 'vitest';

// regionPacks pulls in the filesystem-backed download path via the legacy
// expo-file-system entrypoint, which the shared setup does not stub.
const modelOnDisk = vi.hoisted(() => ({ exists: false }));
vi.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  // A finished download's `.part` file is there; the model itself as the test says.
  getInfoAsync: vi.fn(async (p: string) => ({ exists: p.endsWith('.part') || modelOnDisk.exists, size: 1 })),
  createDownloadResumable: vi.fn(() => ({
    downloadAsync: vi.fn().mockResolvedValue({ status: 200 }),
  })),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  moveAsync: vi.fn().mockResolvedValue(undefined),
}));

import {
  isPackOutdated,
  needsModelDownload,
  syncInstalledPacks,
  type RegionPack,
} from '@/data/regionPacks';

describe('isPackOutdated', () => {
  it('is true when the manifest advertises a newer version', () => {
    expect(isPackOutdated(1, 2)).toBe(true);
  });
  it('is false when versions match', () => {
    expect(isPackOutdated(2, 2)).toBe(false);
  });
  it('is false when the installed pack is newer', () => {
    expect(isPackOutdated(3, 2)).toBe(false);
  });
  it('treats a missing installed version as 0 (needs update)', () => {
    expect(isPackOutdated(undefined, 1)).toBe(true);
  });
  it('is false when the manifest version is missing', () => {
    expect(isPackOutdated(1, undefined)).toBe(false);
  });
});

describe('syncInstalledPacks', () => {
  const pack: RegionPack = {
    id: 'eu-ce',
    version: 2,
    modelUrl: 'https://example.com/eu-ce.pte',
    modelVersion: 2,
    bugs: [],
    labelMap: { 'Apis mellifera': 0 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('re-downloads and reports a pack whose manifest version is newer', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ manifest: 1, packs: { 'eu-ce': { version: 2, url: 'https://example.com/eu-ce.json' } } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => pack }) as unknown as typeof fetch;

    const onUpdated = vi.fn();
    await syncInstalledPacks({
      installedIds: ['eu-ce'],
      installedVersions: { 'eu-ce': 1 },
      documentDirectory: '/docs/',
      onUpdated,
    });

    expect(onUpdated).toHaveBeenCalledWith({ id: 'eu-ce', pack });
  });

  it('does nothing when the installed version is already current', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ manifest: 1, packs: { 'eu-ce': { version: 2, url: 'u' } } }),
    }) as unknown as typeof fetch;

    const onUpdated = vi.fn();
    await syncInstalledPacks({
      installedIds: ['eu-ce'],
      installedVersions: { 'eu-ce': 2 },
      documentDirectory: '/docs/',
      onUpdated,
    });

    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('no-ops on web (null documentDirectory) without touching the network', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const onUpdated = vi.fn();

    await syncInstalledPacks({
      installedIds: ['eu-ce'],
      installedVersions: {},
      documentDirectory: null,
      onUpdated,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});

describe('needsModelDownload', () => {
  const pack: RegionPack = {
    id: 'eu-ce',
    version: 5,
    modelUrl: 'https://example.com/m.pte',
    modelVersion: 4,
    bugs: [],
    labelMap: {},
  };

  it('skips the download when only the pack JSON changed and the model is on disk', async () => {
    modelOnDisk.exists = true;
    expect(await needsModelDownload('/docs/', { ...pack, version: 4 }, pack)).toBe(false);
  });

  it('downloads when the model URL changed', async () => {
    modelOnDisk.exists = true;
    expect(
      await needsModelDownload('/docs/', { ...pack, modelUrl: 'https://example.com/old.pte' }, pack),
    ).toBe(true);
  });

  it('downloads when the pinned checksum changed (a model replaced at the same URL)', async () => {
    modelOnDisk.exists = true;
    expect(await needsModelDownload('/docs/', { ...pack, modelMd5: 'a' }, { ...pack, modelMd5: 'b' })).toBe(true);
    expect(await needsModelDownload('/docs/', { ...pack, modelMd5: 'a' }, { ...pack, modelMd5: 'a' })).toBe(false);
  });

  it('does not re-download just because an older pack had no checksum yet', async () => {
    modelOnDisk.exists = true;
    expect(await needsModelDownload('/docs/', pack, { ...pack, modelMd5: 'b' })).toBe(false);
  });

  it('downloads when the model file is missing or there is no previous pack', async () => {
    modelOnDisk.exists = false;
    expect(await needsModelDownload('/docs/', pack, pack)).toBe(true);
    modelOnDisk.exists = true;
    expect(await needsModelDownload('/docs/', null, pack)).toBe(true);
  });
});
