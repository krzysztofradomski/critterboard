import { backend } from '@/backend';
import type { PublishCatchInput } from '@/backend/types';
import { blurCoords } from '@/lib/blurCoords';
import type { CatchEvent } from '@/lib/streak';
import { useAppStore } from '@/store/useAppStore';

/**
 * Local -> server sync for catches, plus the two ways back out (hide, delete).
 *
 * The phone's catch log is the source of truth. A catch is "on the server" once its key
 * (`bugId:at`) is in `online.uploaded`; everything else is pending and gets uploaded in
 * batches. Uploads are idempotent server-side, so a retry after a half-finished run is safe.
 */

const BATCH = 50;

export const catchKey = (c: Pick<CatchEvent, 'id' | 'at'>) => `${c.id}:${c.at}`;

/** What would be uploaded now, and what is waiting for the user's say-so. */
export function pendingCatches(state: ReturnType<typeof useAppStore.getState>): {
  due: CatchEvent[];
  older: CatchEvent[];
} {
  const { catchLog, online } = state;
  const done = new Set(online.uploaded);
  const open = catchLog.filter((c) => !done.has(catchKey(c)));
  if (online.since === null) return { due: [], older: open };
  const isOlder = (c: CatchEvent) => c.at < (online.since as number);
  return {
    due: open.filter((c) => online.backfill || !isOlder(c)),
    older: online.backfill ? [] : open.filter(isOlder),
  };
}

function toInput(c: CatchEvent, shareLocation: boolean): PublishCatchInput {
  const base: PublishCatchInput = { bugId: c.id, at: c.at };
  if (shareLocation && c.lat !== undefined && c.lng !== undefined) {
    return { ...base, ...blurCoords(c.lat, c.lng) };
  }
  return base;
}

let running: Promise<void> | null = null;

/** Upload every due catch, reporting progress in the store. Never throws; failures show up as `phase: 'error'`. */
export function syncCatches(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const store = useAppStore.getState();
    if (!store.profile.networkOn) return;
    const { due } = pendingCatches(store);
    if (due.length === 0) {
      store.setSyncStatus({ phase: 'idle', done: 0, total: 0 });
      return;
    }
    const share = store.profile.locationShareOn;
    store.setSyncStatus({ phase: 'syncing', done: 0, total: due.length });
    let done = 0;
    try {
      for (let i = 0; i < due.length; i += BATCH) {
        const chunk = due.slice(i, i + BATCH);
        await backend.publishCatches(chunk.map((c) => toInput(c, share)));
        useAppStore.getState().markUploaded(chunk.map(catchKey));
        done += chunk.length;
        useAppStore.getState().setSyncStatus({ phase: 'syncing', done, total: due.length });
      }
      useAppStore.getState().setSyncStatus({ phase: 'idle', done: 0, total: 0 });
    } catch {
      useAppStore.getState().setSyncStatus({ phase: 'error', done, total: due.length });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Tell the server this user is hidden (used before Network goes off while the profile stays online). */
export async function hideOnlineProfile(): Promise<boolean> {
  const { profile } = useAppStore.getState();
  try {
    await backend.syncProfile({ displayName: profile.name, leaderboardVisible: false, country: 'private' });
    return true;
  } catch {
    return false;
  }
}

/** Remove stored catch coordinates from the server. */
export async function clearOnlineLocations(): Promise<boolean> {
  try {
    await backend.clearLocations();
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete everything stored online for this user, then reset the local bookkeeping so a later
 * opt-in starts clean. Resolves false (and changes nothing) if the server couldn't be reached.
 */
export async function deleteOnlineData(): Promise<boolean> {
  try {
    await backend.deleteAccount();
  } catch {
    return false;
  }
  const s = useAppStore.getState();
  s.setOnline({ since: null, hasData: false, backfill: false, uploaded: [] });
  s.setSyncStatus({ phase: 'idle', done: 0, total: 0 });
  return true;
}
