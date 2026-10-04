import { beforeEach, describe, expect, it, vi } from 'vitest';

// path → contents; a download writes `net.body` with `net.status`, or resolves undefined when cancelled.
const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  net: { body: 'MODEL', status: 200 as number | null },
}));

vi.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: vi.fn((_url: string, path: string) => ({
    downloadAsync: vi.fn(async () => {
      if (fs.net.status === null) return undefined;
      fs.files.set(path, fs.net.body);
      return { status: fs.net.status };
    }),
  })),
  getInfoAsync: vi.fn(async (p: string, o?: { md5?: boolean }) => {
    const body = fs.files.get(p);
    if (body === undefined) return { exists: false };
    return { exists: true, size: body.length, ...(o?.md5 ? { md5: `md5(${body})` } : {}) };
  }),
  deleteAsync: vi.fn(async (p: string) => void fs.files.delete(p)),
  moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    fs.files.set(to, fs.files.get(from)!);
    fs.files.delete(from);
  }),
}));

import { downloadFile } from '@/lib/download';

const DEST = 'file:///docs/model.pte';
const URL = 'https://example.com/model.pte';

describe('downloadFile', () => {
  beforeEach(() => {
    fs.files.clear();
    fs.files.set(DEST, 'OLD');
    fs.net = { body: 'MODEL', status: 200 };
  });

  it('replaces the file once the download checks out', async () => {
    await downloadFile(URL, DEST, { expect: { bytes: 5, md5: 'MD5(MODEL)' } });
    expect(fs.files.get(DEST)).toBe('MODEL');
    expect(fs.files.has(`${DEST}.part`)).toBe(false);
  });

  it.each([
    ['an error page (HTTP 404)', () => (fs.net.status = 404), {}],
    ['a cancelled download', () => (fs.net.status = null), {}],
    ['a truncated file', () => (fs.net.body = 'MOD'), { expect: { bytes: 5 } }],
    ['a corrupted file', () => (fs.net.body = 'MODEX'), { expect: { md5: 'md5(MODEL)' } }],
    ['a file that fails the format check', () => undefined, { verify: async () => false }],
  ])('keeps the old file and drops the part on %s', async (_label, arrange, opts) => {
    arrange();
    await expect(downloadFile(URL, DEST, opts)).rejects.toThrow();
    expect(fs.files.get(DEST)).toBe('OLD');
    expect(fs.files.has(`${DEST}.part`)).toBe(false);
  });

  it('refuses plain HTTP outside development', async () => {
    await expect(downloadFile('http://example.com/model.pte', DEST)).rejects.toThrow(/HTTPS/);
    expect(fs.files.get(DEST)).toBe('OLD');
  });
});
