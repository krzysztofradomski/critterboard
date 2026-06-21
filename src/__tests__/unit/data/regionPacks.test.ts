import { vi, describe, it, expect, beforeEach } from 'vitest';

// regionPacks pulls in the filesystem-backed download path via the legacy
// expo-file-system entrypoint, which the shared setup does not stub.
vi.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  createDownloadResumable: vi.fn(() => ({
    downloadAsync: vi.fn().mockResolvedValue({}),
  })),
}));

import { isPackOutdated, syncInstalledPacks, type RegionPack } from '@/data/regionPacks';

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
    global.fetch = vi
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
    global.fetch = vi.fn().mockResolvedValueOnce({
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
    global.fetch = fetchSpy as unknown as typeof fetch;
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
