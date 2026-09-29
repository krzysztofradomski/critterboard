import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the legacy filesystem API: path → bytes (as a binary string).
const fs = vi.hoisted(() => {
  const files = new Map<string, string>();
  const atlas = 'RIFF-lady|RIFF-harl-longer|';
  return {
    files,
    atlas,
    downloads: 0,
    failDownload: false,
  };
});

vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  getInfoAsync: vi.fn(async (p: string) => ({ exists: fs.files.has(p) })),
  makeDirectoryAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async (p: string) => {
    for (const k of [...fs.files.keys()]) if (k === p || k.startsWith(p)) fs.files.delete(k);
  }),
  downloadAsync: vi.fn(async (_url: string, p: string) => {
    if (fs.failDownload) throw new Error('offline');
    fs.downloads += 1;
    fs.files.set(p, fs.atlas);
    return { status: 200 };
  }),
  readAsStringAsync: vi.fn(async (p: string, o: { position: number; length: number }) =>
    btoa(fs.files.get(p)!.slice(o.position, o.position + o.length)),
  ),
  writeAsStringAsync: vi.fn(async (p: string, data: string, o?: { encoding?: string }) => {
    fs.files.set(p, o?.encoding === 'base64' ? atob(data) : data);
  }),
}));

import { bugIconUri, ensurePackIcons, removePackIcons, type PackIcons } from '@/data/bugIcons';

const DOC = 'file:///docs/';
const DIR = `${DOC}icons/eu-ce/`;
const icons = (version: number): PackIcons => ({
  url: 'https://example.com/icons.bin',
  version,
  index: { lady: [0, 10], harl: [10, 17] },
});

describe('ensurePackIcons', () => {
  beforeEach(async () => {
    await removePackIcons(DOC, 'eu-ce');
    fs.files.clear();
    fs.downloads = 0;
    fs.failDownload = false;
  });

  it('downloads the atlas, splits it into one file per species and registers them', async () => {
    expect(await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(1) })).toBe(true);
    expect(fs.files.get(`${DIR}lady.webp`)).toBe('RIFF-lady|');
    expect(fs.files.get(`${DIR}harl.webp`)).toBe('RIFF-harl-longer|');
    expect(fs.files.has(`${DIR}atlas.bin`)).toBe(false);
    expect(fs.files.has(`${DIR}.v1`)).toBe(true);
    expect(bugIconUri('lady')).toBe(`${DIR}lady.webp`);
    expect(bugIconUri('peac')).toBeUndefined();
  });

  it('reuses icons already on disk for the same version', async () => {
    await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(1) });
    await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(1) });
    expect(fs.downloads).toBe(1);
  });

  it('replaces the folder when the icon version changes', async () => {
    await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(1) });
    await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(2) });
    expect(fs.downloads).toBe(2);
    expect(fs.files.has(`${DIR}.v1`)).toBe(false);
    expect(fs.files.has(`${DIR}.v2`)).toBe(true);
  });

  it('falls back to emoji (nothing registered) when the download fails', async () => {
    fs.failDownload = true;
    expect(await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(1) })).toBe(false);
    expect(bugIconUri('lady')).toBeUndefined();
  });

  it('is a no-op without a filesystem (web) or without icons (older packs)', async () => {
    expect(await ensurePackIcons(null, { id: 'eu-ce', icons: icons(1) })).toBe(false);
    expect(await ensurePackIcons(DOC, { id: 'eu-ce' })).toBe(false);
    expect(fs.downloads).toBe(0);
  });

  it('removePackIcons unregisters and deletes the folder', async () => {
    await ensurePackIcons(DOC, { id: 'eu-ce', icons: icons(1) });
    await removePackIcons(DOC, 'eu-ce');
    expect(bugIconUri('lady')).toBeUndefined();
    expect([...fs.files.keys()].some((k) => k.startsWith(DIR))).toBe(false);
  });
});
