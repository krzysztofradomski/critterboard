/**
 * React bindings for the backend adapter.
 *
 * Tiny, dependency-free hooks (no react-query). Each hook owns:
 *   - one in-flight request keyed by inputs,
 *   - a `{ data | error | loading }` triple the screen can render,
 *   - a `refetch()` for pull-to-refresh / tab-switch refreshes.
 *
 * Every hook respects `profile.networkOn`. When it's off the hook
 * stays in `loading: false, data: null, error: 'offline'` — the
 * adapter is never called, so the cloudflare implementation never
 * leaks a request.
 *
 * Identity binding for the mock adapter is wired here (one effect at
 * the top of the tree via `useBindBackend`) so screens never need to
 * know which adapter is live.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { backend, bindMockIdentity, BackendError } from '@/backend';
import { syncCatches } from '@/backend/sync';
import { clearQueue, forgetShared, loadQueue, processQueue, queueItems, sharedBugIds, subscribeQueue } from '@/backend/trainingQueue';
import type {
  FeedPage,
  FriendScope,
  FriendsPage,
  LeaderboardPage,
  LeaderboardScope,
  PageOpts,
  ProfileSnapshot,
  UserId,
  Sighting,
} from '@/backend';
import { findBug } from '@/data/bugs';
import { useAppStore } from '@/store/useAppStore';
import { useXp } from '@/lib/level';

// ──────────────────────────────────────────────────────────────────────────
// Per-call query state
// ──────────────────────────────────────────────────────────────────────────

type QueryState<T> = {
  data: T | null;
  error: BackendError | null;
  loading: boolean;
  /** Re-run the query. Bumps an internal token so stale resolves are dropped. */
  refetch: () => void;
};

/**
 * Generic single-call hook. Re-runs when `key` changes or `refetch` is
 * called. Stale resolves (a slow first call after a fast second call)
 * are discarded via a request token.
 */
function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  enabled: boolean,
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<BackendError | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [bump, setBump] = useState(0);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(new BackendError('offline', 'network disabled'));
      setLoading(false);
      return;
    }
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((next) => {
        if (token !== tokenRef.current) return;
        setData(next);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        const err =
          e instanceof BackendError
            ? e
            : new BackendError('unknown', String((e as Error)?.message ?? e));
        setError(err);
        setLoading(false);
      });
    // The `key` is a memo handle for the screen to widen — we read
    // it so the linter sees the dep, but the fetcher closes over the
    // real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, bump, enabled]);

  const refetch = useCallback(() => setBump((b) => b + 1), []);
  return { data, error, loading, refetch };
}

// ──────────────────────────────────────────────────────────────────────────
// Self-binding bridge — fed at every adapter call so the mock sees fresh xp
// ──────────────────────────────────────────────────────────────────────────

/**
 * Plumbs live store state into the mock adapter's `requireSelf()`.
 * Re-binds on every dep change so the mock always sees the latest
 * xp/followed/visibility snapshot — cheap because `bindMockIdentity`
 * just swaps a function pointer.
 */
function useSelfBridge(): void {
  const profile = useAppStore((s) => s.profile);
  const followed = useAppStore((s) => s.followed);
  const backendUserId = useAppStore((s) => s.backendUserId);
  const mapLocation = useAppStore((s) => s.mapLocation);
  const xp = useXp();

  useEffect(() => {
    bindMockIdentity(() => ({
      userId: backendUserId,
      displayName: profile.name,
      country:
        profile.locationShareOn && profile.networkOn
          ? mapLocation?.region || 'private'
          : 'private',
      xp,
      followed,
      leaderboardVisible: profile.leaderboardOn && profile.networkOn,
    }));
  }, [backendUserId, profile, followed, mapLocation, xp]);
}

/**
 * Public mount-once hook for `App.tsx`. Replaces the placeholder
 * `useBindBackend` above (kept exported for back-compat with any
 * caller that doesn't need live xp).
 */
export function useBackendIdentityBridge(): void {
  useSelfBridge();
}

// ──────────────────────────────────────────────────────────────────────────
// Public query hooks
// ──────────────────────────────────────────────────────────────────────────

export type UseLeaderboardOpts = PageOpts;

export function useLeaderboard(
  scope: LeaderboardScope,
  opts?: UseLeaderboardOpts,
): QueryState<LeaderboardPage> {
  useSelfBridge();
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const xp = useXp();
  const followedSize = useAppStore((s) => s.followed.size);
  // Re-key on inputs the snapshot depends on (xp drives the user's
  // slot; followed size drives the friends scope).
  const key = `lb:${scope}:${opts?.cursor ?? ''}:${opts?.limit ?? ''}:${xp}:${followedSize}:${networkOn ? 1 : 0}`;
  const fetcher = useCallback(
    () => backend.fetchLeaderboard(scope, opts),
    [scope, opts?.cursor, opts?.limit],
  );
  return useQuery(key, fetcher, networkOn);
}

export function useFriends(
  scope: FriendScope,
  opts?: PageOpts,
): QueryState<FriendsPage> {
  useSelfBridge();
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const followedSize = useAppStore((s) => s.followed.size);
  const key = `fr:${scope}:${opts?.cursor ?? ''}:${opts?.limit ?? ''}:${followedSize}:${networkOn ? 1 : 0}`;
  const fetcher = useCallback(
    () => backend.fetchFriends(scope, opts),
    [scope, opts?.cursor, opts?.limit],
  );
  return useQuery(key, fetcher, networkOn);
}

export function useFeed(opts?: PageOpts): QueryState<FeedPage> {
  useSelfBridge();
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const followedSize = useAppStore((s) => s.followed.size);
  const key = `feed:${opts?.cursor ?? ''}:${opts?.limit ?? ''}:${followedSize}:${networkOn ? 1 : 0}`;
  const fetcher = useCallback(
    () => backend.fetchFeed(opts),
    [opts?.cursor, opts?.limit],
  );
  return useQuery(key, fetcher, networkOn);
}

// ──────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────

/**
 * Follow/unfollow with optimistic local store update. The store
 * `toggleFollow` action is the source of truth; the backend call is
 * fire-and-forget after.
 *
 * Returns a stable callback that wraps `toggleFollow` and also
 * notifies the server. Safe to spread into onPress handlers.
 */
export function useToggleFollow(): (userId: UserId) => void {
  const toggleFollow = useAppStore((s) => s.toggleFollow);
  const followed = useAppStore((s) => s.followed);
  const networkOn = useAppStore((s) => s.profile.networkOn);

  return useCallback(
    (userId: UserId) => {
      const wasFollowing = followed.has(userId);
      toggleFollow(userId);
      if (!networkOn) return;
      const call = wasFollowing ? backend.unfollow(userId) : backend.follow(userId);
      // Fire-and-forget. Swallow errors — the local toggle already
      // succeeded; a retry on next mount picks up the divergence.
      void call.catch(() => undefined);
    },
    [followed, networkOn, toggleFollow],
  );
}

/**
 * Sync the caller's profile snapshot to the server whenever any
 * identity-visible field changes (display name, leaderboard visibility,
 * location share). Fire-and-forget — local state is already the source
 * of truth; a sync failure just means the server lags by one session.
 * Gated on `networkOn`, same as every other adapter call.
 */
export function useSyncProfile(): void {
  const name = useAppStore((s) => s.profile.name);
  const leaderboardOn = useAppStore((s) => s.profile.leaderboardOn);
  const locationShareOn = useAppStore((s) => s.profile.locationShareOn);
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const region = useAppStore((s) => s.mapLocation?.region);

  useEffect(() => {
    if (!networkOn) return;
    const snapshot: ProfileSnapshot = {
      displayName: name,
      leaderboardVisible: leaderboardOn,
      country: locationShareOn ? (region ?? undefined) : 'private',
    };
    const store = useAppStore.getState();
    // First time online: remember when, so older catches wait for an explicit upload.
    if (store.online.since === null) store.setOnline({ since: Date.now() });
    void backend
      .syncProfile(snapshot)
      .then(() => {
        // The real settings are on the server now, so an owed "hide" (from an earlier Network off) is moot.
        const { online, setOnline } = useAppStore.getState();
        if (!online.hasData || online.hideOwed) setOnline({ hasData: true, hideOwed: false });
      })
      .catch(() => undefined);
  }, [name, leaderboardOn, locationShareOn, networkOn, region]);
}

/**
 * Push a catch to the backend. Called from the local `catchBug`
 * pipeline — fans out feed events to followers server-side.
 */
export function usePublishCatch(): (bugId: string, at: number, lat?: number, lng?: number) => void {
  const networkOn = useAppStore((s) => s.profile.networkOn);

  return useCallback(
    (bugId, at, lat, lng) => {
      if (!networkOn) return;
      // A self-named species never goes online (the batch sync skips it too).
      const ev = useAppStore.getState().catchLog.find((c) => c.id === bugId && c.at === at);
      if (ev?.source === 'manual') return;
      const input =
        lat != null && lng != null ? { bugId, at, lat, lng } : { bugId, at };
      void backend
        .publishCatch(input)
        .then(() => useAppStore.getState().markUploaded([`${bugId}:${at}`]))
        // Not lost: it stays pending in the catch log and the batch upload picks it up.
        .catch(() => void syncCatches());
    },
    [networkOn],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Time helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Memo helper for stable `PageOpts` objects. Without this, inline
 * `{ limit: 10 }` would re-render the query on every parent render.
 */
export function usePageOpts(opts: PageOpts): PageOpts {
  return useMemo(
    () => opts,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.cursor, opts.limit],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared sightings (Map overlay)
// ──────────────────────────────────────────────────────────────────────────

const SIGHTINGS_TTL_MS = 10 * 60_000;
// Last answer, per ~1 km spot: coming back to the Map within 10 minutes doesn't ask again.
let sightingsCache: { key: string; at: number; data: Sighting[] } | null = null;

/**
 * Other players' shared catches near the player, when "Show others' sightings" and Network are on
 * and the player's location is known. Empty otherwise, or when the request fails (it's an extra).
 */
export function useNearbySightings(): Sighting[] {
  const on = useAppStore((s) => s.profile.networkOn && s.profile.sightingsOn);
  const loc = useAppStore((s) => s.mapLocation);
  const key = loc ? `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}` : null;
  const [data, setData] = useState<Sighting[]>(() =>
    sightingsCache && sightingsCache.key === key ? sightingsCache.data : [],
  );

  useEffect(() => {
    if (!on || !loc || !key) return;
    if (sightingsCache?.key === key && Date.now() - sightingsCache.at < SIGHTINGS_TTL_MS) {
      setData(sightingsCache.data);
      return;
    }
    let cancelled = false;
    backend
      .fetchNearbySightings(loc.lat, loc.lng)
      .then((all) => {
        // Only species this phone knows (another player may have a different pack).
        const next = all.filter((x) => findBug(x.bugId));
        sightingsCache = { key, at: Date.now(), data: next };
        if (!cancelled) setData(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // `key` stands for `loc` (rounded): a GPS wobble under ~1 km doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);

  return on ? data : [];
}

// ──────────────────────────────────────────────────────────────────────────
// Training contributions
// ──────────────────────────────────────────────────────────────────────────

const deleteLocal = (uri: string) => FileSystem.deleteAsync(uri, { idempotent: true });

/**
 * Drain the training upload queue while Network and "Help train the model" are both on: at once,
 * every minute, and when the app comes back to the foreground. Mounted once, in App.
 */
export function useTrainingUploader(): void {
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const shareOn = useAppStore((s) => s.profile.trainingShareOn);
  useEffect(() => {
    if (!networkOn || !shareOn) return;
    const run = () =>
      void processQueue({
        upload: (meta, uri) => backend.uploadContribution(meta, uri),
        fileExists: async (uri) => (await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }))).exists,
        deleteFile: deleteLocal,
        now: Date.now,
        // Switching Network or Help train off stops a pass already under way.
        shouldContinue: () => {
          const p = useAppStore.getState().profile;
          return p.networkOn && p.trainingShareOn;
        },
      });
    run();
    const timer = setInterval(run, 60_000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [networkOn, shareOn]);
}

/** Brains: photos waiting on the phone, photos already shared (null until known), and Delete. */
/** A Dex entry's training state: a photo already shared, one waiting on the phone, or neither. */
export type TrainingMark = 'shared' | 'waiting' | null;

const marksKey = () => `${queueItems().map((i) => i.meta.bug_id).join(',')}|${sharedBugIds().join(',')}`;

/** The training mark for any species, kept current as the queue uploads (Dex tiles, species page). */
export function useTrainingMarks(): (bugId: string) => TrainingMark {
  const key = useSyncExternalStore(subscribeQueue, marksKey, () => '|');
  useEffect(() => {
    void loadQueue();
  }, []);
  return useMemo(() => {
    const [waiting, shared] = key.split('|').map((part) => new Set(part ? part.split(',') : []));
    return (bugId) => (shared!.has(bugId) ? 'shared' : waiting!.has(bugId) ? 'waiting' : null);
  }, [key]);
}

export function useTrainingStats(): { waiting: number; shared: number | null; deleteAll: () => Promise<boolean> } {
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const waiting = useSyncExternalStore(subscribeQueue, () => queueItems().length, () => 0);
  const [shared, setShared] = useState<number | null>(null);
  useEffect(() => {
    void loadQueue();
    if (!networkOn) return;
    let live = true;
    backend.fetchContributionCount().then((n) => live && setShared(n), () => undefined);
    return () => {
      live = false;
    };
  }, [networkOn, waiting]);
  const deleteAll = useCallback(async () => {
    await clearQueue(deleteLocal);
    if (!networkOn) return false;
    try {
      await backend.deleteContributions();
      setShared(0);
      await forgetShared();
      return true;
    } catch {
      return false;
    }
  }, [networkOn]);
  return { waiting, shared, deleteAll };
}
