import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backend } from '@/backend';
import {
  catchKey,
  clearOnlineLocations,
  deleteOnlineData,
  hideOnlineProfile,
  pendingCatches,
  settleOwedCleanups,
  syncCatches,
} from '@/backend/sync';
import { EMPTY_ONLINE, useAppStore } from '@/store/useAppStore';

const log = (n: number, at0: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `bug${i}`, at: at0 + i, lat: 50, lng: 19 }));

function setup(over: { catchLog: ReturnType<typeof log>; online?: Partial<typeof EMPTY_ONLINE>; networkOn?: boolean; share?: boolean }) {
  useAppStore.setState({
    catchLog: over.catchLog,
    online: { ...EMPTY_ONLINE, ...over.online },
    syncStatus: { phase: 'idle', done: 0, total: 0 },
    profile: {
      ...useAppStore.getState().profile,
      networkOn: over.networkOn ?? true,
      locationShareOn: over.share ?? false,
    },
  });
}

beforeEach(() => vi.restoreAllMocks());

describe('pendingCatches', () => {
  it('holds earlier catches back until the user agrees', () => {
    setup({ catchLog: [...log(2, 1_000), ...log(1, 9_000)], online: { since: 5_000 } });
    const { due, older } = pendingCatches(useAppStore.getState());
    expect(due.map((c) => c.at)).toEqual([9_000]);
    expect(older).toHaveLength(2);
  });

  it('includes them once backfill is accepted, and skips what is already uploaded', () => {
    const l = log(3, 1_000);
    setup({ catchLog: l, online: { since: 5_000, backfill: true, uploaded: [catchKey(l[0]!)] } });
    const { due, older } = pendingCatches(useAppStore.getState());
    expect(due).toHaveLength(2);
    expect(older).toHaveLength(0);
  });

  it('uploads nothing before Network was ever on', () => {
    setup({ catchLog: log(2, 1_000) });
    expect(pendingCatches(useAppStore.getState()).due).toHaveLength(0);
  });
});

describe('syncCatches', () => {
  it('uploads in batches, reports progress and marks catches uploaded', async () => {
    setup({ catchLog: log(120, 10_000), online: { since: 1 } });
    const spy = vi.spyOn(backend, 'publishCatches').mockResolvedValue();
    await syncCatches();
    expect(spy.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    const s = useAppStore.getState();
    expect(s.online.uploaded).toHaveLength(120);
    expect(s.online.hasData).toBe(true);
    expect(s.syncStatus.phase).toBe('idle');
  });

  it('keeps failed catches pending and shows the error', async () => {
    setup({ catchLog: log(3, 10_000), online: { since: 1 } });
    vi.spyOn(backend, 'publishCatches').mockRejectedValue(new Error('offline'));
    await syncCatches();
    const s = useAppStore.getState();
    expect(s.online.uploaded).toHaveLength(0);
    expect(s.syncStatus).toMatchObject({ phase: 'error', done: 0, total: 3 });
    expect(pendingCatches(s).due).toHaveLength(3);
  });

  it('sends blurred coordinates only when location sharing is on', async () => {
    setup({ catchLog: log(1, 10_000), online: { since: 1 }, share: false });
    const spy = vi.spyOn(backend, 'publishCatches').mockResolvedValue();
    await syncCatches();
    expect(spy.mock.calls[0]![0][0]).toEqual({ bugId: 'bug0', at: 10_000 });

    setup({ catchLog: log(1, 20_000), online: { since: 1 }, share: true });
    await syncCatches();
    const sent = spy.mock.calls[1]![0][0]!;
    expect(sent.lat).not.toBe(50); // blurred
    expect(Math.abs((sent.lat as number) - 50)).toBeLessThan(0.01);
  });

  it('does nothing while Network is off', async () => {
    setup({ catchLog: log(2, 10_000), online: { since: 1 }, networkOn: false });
    const spy = vi.spyOn(backend, 'publishCatches').mockResolvedValue();
    await syncCatches();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('deleteOnlineData', () => {
  it('resets the bookkeeping after the server deleted everything', async () => {
    setup({ catchLog: log(1, 1), online: { since: 1, hasData: true, uploaded: ['x:1'] } });
    vi.spyOn(backend, 'deleteAccount').mockResolvedValue();
    expect(await deleteOnlineData()).toBe(true);
    expect(useAppStore.getState().online).toEqual(EMPTY_ONLINE);
  });

  it('moves to a fresh identity: the deleted id is public and anyone could claim it', async () => {
    setup({ catchLog: log(1, 1), online: { since: 1, hasData: true } });
    const before = useAppStore.getState();
    vi.spyOn(backend, 'deleteAccount').mockResolvedValue();
    await deleteOnlineData();
    const after = useAppStore.getState();
    expect(after.backendUserId).not.toBe(before.backendUserId);
    expect(after.backendSecret).not.toBe(before.backendSecret);
    expect(after.backendSecret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes nothing if the server could not be reached', async () => {
    setup({ catchLog: log(1, 1), online: { since: 1, hasData: true, uploaded: ['x:1'] } });
    const { backendUserId } = useAppStore.getState();
    vi.spyOn(backend, 'deleteAccount').mockRejectedValue(new Error('offline'));
    expect(await deleteOnlineData()).toBe(false);
    expect(useAppStore.getState().online.hasData).toBe(true);
    expect(useAppStore.getState().backendUserId).toBe(backendUserId);
  });
});

describe('owed privacy cleanups', () => {
  it('remembers a hide that failed and retries it at launch, even with Network now off', async () => {
    setup({ catchLog: [], online: { hasData: true }, networkOn: false });
    const hide = vi.spyOn(backend, 'syncProfile').mockRejectedValueOnce(new Error('offline'));
    expect(await hideOnlineProfile()).toBe(false);
    expect(useAppStore.getState().online.hideOwed).toBe(true);

    hide.mockResolvedValueOnce();
    await settleOwedCleanups();
    expect(hide).toHaveBeenLastCalledWith(expect.objectContaining({ leaderboardVisible: false }));
    expect(useAppStore.getState().online.hideOwed).toBe(false);
  });

  it('remembers a location clear that failed and retries it at launch', async () => {
    setup({ catchLog: [], online: { hasData: true } });
    const clear = vi.spyOn(backend, 'clearLocations').mockRejectedValueOnce(new Error('offline'));
    expect(await clearOnlineLocations()).toBe(false);
    expect(useAppStore.getState().online.clearLocationsOwed).toBe(true);

    clear.mockResolvedValueOnce();
    await settleOwedCleanups();
    expect(clear).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().online.clearLocationsOwed).toBe(false);
  });

  it('drops an owed hide once Network is back on: the profile sync sends the real settings', async () => {
    setup({ catchLog: [], online: { hasData: true, hideOwed: true }, networkOn: true });
    const hide = vi.spyOn(backend, 'syncProfile').mockResolvedValue();
    await settleOwedCleanups();
    expect(hide).not.toHaveBeenCalled();
  });

  it('forgets what was owed once the account is deleted', async () => {
    setup({ catchLog: [], online: { hasData: true, hideOwed: true, clearLocationsOwed: true } });
    vi.spyOn(backend, 'deleteAccount').mockResolvedValue();
    await deleteOnlineData();
    expect(useAppStore.getState().online).toEqual(EMPTY_ONLINE);
  });
});
