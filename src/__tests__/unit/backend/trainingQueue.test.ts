import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContribution } from '@/lib/contributions';

// A storage that remembers, so "survives a restart" means something.
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
  },
}));

const NOW = Date.UTC(2026, 9, 12, 12);
const meta = (id: string) =>
  buildContribution({
    id, bugId: 'harl', latin: 'Harmonia axyridis', kind: 'manual', top3: [], aim: {},
    creditName: 'K', modelVersion: 7, packVersion: 14, at: NOW,
  });

async function fresh() {
  vi.resetModules();
  return import('@/backend/trainingQueue');
}

function deps(statuses: number[], files = new Set(['file:///a.jpg', 'file:///b.jpg'])) {
  const deleted: string[] = [];
  let t = NOW;
  return {
    deleted,
    files,
    setNow: (x: number) => (t = x),
    d: {
      upload: vi.fn(async () => statuses.shift() ?? 201),
      fileExists: vi.fn(async (u: string) => files.has(u)),
      deleteFile: vi.fn(async (u: string) => {
        deleted.push(u);
        files.delete(u);
      }),
      now: () => t,
      shouldContinue: () => true,
    },
  };
}

describe('training upload queue', () => {
  beforeEach(() => store.clear());

  it('uploads queued photos one by one and deletes the local copy once sent', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    await q.enqueueContribution(meta('c_bbbbbbbbbb'), 'file:///b.jpg', NOW);
    const { d, deleted } = deps([201, 201]);
    expect(await q.processQueue(d)).toEqual({ sent: 2 });
    expect(q.queueItems()).toEqual([]);
    expect(deleted).toEqual(['file:///a.jpg', 'file:///b.jpg']);
  });

  it('marks a species shared only once the server accepts it, survives a restart, and forgets on request', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    await q.processQueue(deps([503]).d); // retry: still waiting, not shared
    expect(q.sharedBugIds()).toEqual([]);
    const later = deps([201]);
    later.setNow(NOW + 3_600_000);
    await q.processQueue(later.d);
    expect(q.sharedBugIds()).toEqual(['harl']);
    const again = await fresh();
    await again.loadQueue();
    expect(again.sharedBugIds()).toEqual(['harl']);
    await again.forgetShared('harl');
    expect(again.sharedBugIds()).toEqual([]);
  });

  it('keeps a photo for later on a rate limit or server error, with backoff', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    const { d, setNow } = deps([503, 201]);
    await q.processQueue(d);
    expect(q.queueItems()).toMatchObject([{ tries: 1, nextAt: NOW + 60_000 }]);
    await q.processQueue(d); // not due yet
    expect(d.upload).toHaveBeenCalledTimes(1);
    setNow(NOW + 61_000);
    expect(await q.processQueue(d)).toEqual({ sent: 1 });
    expect(q.queueItems()).toEqual([]);
  });

  it('drops a photo the server refuses, one whose file is gone, and one older than 7 days', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    await q.enqueueContribution(meta('c_bbbbbbbbbb'), 'file:///gone.jpg', NOW);
    await q.enqueueContribution(meta('c_cccccccccc'), 'file:///b.jpg', NOW - 8 * 86_400_000);
    const { d, deleted } = deps([400]);
    await q.processQueue(d);
    expect(q.queueItems()).toEqual([]);
    expect(d.upload).toHaveBeenCalledTimes(1);
    expect(deleted).toContain('file:///a.jpg');
    expect(deleted).toContain('file:///b.jpg');
  });

  it('survives a restart', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    const again = await fresh();
    await again.loadQueue();
    expect(again.queueItems().map((i) => i.meta.id)).toEqual(['c_aaaaaaaaaa']);
  });

  it('clearQueue empties it and deletes the local copies', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    const { d, deleted } = deps([]);
    await q.clearQueue(d.deleteFile);
    expect(q.queueItems()).toEqual([]);
    expect(deleted).toEqual(['file:///a.jpg']);
  });

  it('stops mid-pass when Network or Help train is switched off', async () => {
    const q = await fresh();
    await q.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    await q.enqueueContribution(meta('c_bbbbbbbbbb'), 'file:///b.jpg', NOW);
    const { d } = deps([201, 201]);
    let on = true;
    d.upload.mockImplementation(async () => {
      on = false; // the player switches sharing off during the first upload
      return 201;
    });
    expect(await q.processQueue({ ...d, shouldContinue: () => on })).toEqual({ sent: 1 });
    expect(q.queueItems().map((i) => i.meta.id)).toEqual(['c_bbbbbbbbbb']);
  });

  it('does not lose an item queued while the stored queue is still loading', async () => {
    const first = await fresh();
    await first.enqueueContribution(meta('c_aaaaaaaaaa'), 'file:///a.jpg', NOW);
    const q = await fresh();
    await Promise.all([q.loadQueue(), q.enqueueContribution(meta('c_bbbbbbbbbb'), 'file:///b.jpg', NOW)]);
    expect(q.queueItems().map((i) => i.meta.id)).toEqual(['c_aaaaaaaaaa', 'c_bbbbbbbbbb']);
  });
});
