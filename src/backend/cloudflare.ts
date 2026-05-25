/**
 * Cloudflare backend adapter — real HTTP client.
 *
 * Exchanges the device-local `backendUserId` for a signed JWT on first
 * call, then sends every subsequent request with `Authorization: Bearer
 * <jwt>`. Token is cached in memory (warm across navigations, reset on
 * cold start — cheap because auth is one D1 upsert + JWT mint).
 *
 * Base URL is read from `EXPO_PUBLIC_BACKEND_URL`. Flip
 * `USE_REMOTE_BACKEND` in `src/backend/index.ts` once the Worker is
 * deployed (or it auto-flips when the env var is set — see index.ts).
 *
 * See `worker/` for the Cloudflare Workers service that answers these
 * calls, and `docs/decisions/002-backend-adapter-seam.md` for the ADR.
 */

import { useAppStore } from '@/store/useAppStore';
import type { BackendAdapter, PageOpts } from '@/backend/adapter';
import {
  BackendError,
  type BackendUser,
  type FeedPage,
  type FriendScope,
  type FriendsPage,
  type LeaderboardPage,
  type LeaderboardScope,
  type ProfileSnapshot,
  type PublishCatchInput,
  type UserId,
} from '@/backend/types';

// ──────────────────────────────────────────────────────────────────────────
// Base URL
// ──────────────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
  if (!url) {
    throw new BackendError(
      'unavailable',
      'EXPO_PUBLIC_BACKEND_URL is not set. ' +
        'Deploy the Worker, set the env var, and the adapter auto-activates.',
    );
  }
  return url;
}

// ──────────────────────────────────────────────────────────────────────────
// In-memory JWT cache
// ──────────────────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let adapterReady = false;

async function fetchToken(userId: string): Promise<string> {
  const base = getBaseUrl();
  let resp: Response;
  try {
    resp = await fetch(`${base}/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch {
    throw new BackendError('offline', 'Network request failed during auth');
  }
  if (resp.status === 429) throw new BackendError('rate-limited', 'Auth rate-limited');
  if (!resp.ok) throw new BackendError('unavailable', `Auth failed: HTTP ${resp.status}`);
  const data = (await resp.json()) as { token: string };
  return data.token;
}

// ──────────────────────────────────────────────────────────────────────────
// Authenticated fetch
// ──────────────────────────────────────────────────────────────────────────

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getBaseUrl();
  const userId = useAppStore.getState().backendUserId;

  if (!cachedToken) {
    cachedToken = await fetchToken(userId);
    adapterReady = true;
  }

  const doRequest = async (token: string): Promise<Response> => {
    let resp: Response;
    try {
      resp = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      throw new BackendError('offline', 'Network request failed');
    }
    return resp;
  };

  let resp = await doRequest(cachedToken);

  // Re-auth on 401 (expired / invalidated token).
  if (resp.status === 401) {
    cachedToken = null;
    adapterReady = false;
    cachedToken = await fetchToken(userId);
    adapterReady = true;
    resp = await doRequest(cachedToken);
  }

  if (resp.status === 429) throw new BackendError('rate-limited', 'Rate limit exceeded');
  if (!resp.ok) throw new BackendError('unavailable', `HTTP ${resp.status}`);
  return resp;
}

// ──────────────────────────────────────────────────────────────────────────
// Adapter
// ──────────────────────────────────────────────────────────────────────────

export const cloudflareAdapter: BackendAdapter = {
  async identity(): Promise<BackendUser> {
    const resp = await authedFetch('/v1/identity');
    return (await resp.json()) as BackendUser;
  },

  async syncProfile(snapshot: ProfileSnapshot): Promise<void> {
    await authedFetch('/v1/profile', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
  },

  async publishCatch(input: PublishCatchInput): Promise<void> {
    await authedFetch('/v1/catches', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async fetchLeaderboard(scope: LeaderboardScope, opts?: PageOpts): Promise<LeaderboardPage> {
    const params = new URLSearchParams({ scope });
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    const resp = await authedFetch(`/v1/leaderboard?${params}`);
    return (await resp.json()) as LeaderboardPage;
  },

  async fetchFriends(scope: FriendScope, opts?: PageOpts): Promise<FriendsPage> {
    const params = new URLSearchParams({ scope });
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    const resp = await authedFetch(`/v1/friends?${params}`);
    return (await resp.json()) as FriendsPage;
  },

  async fetchFeed(opts?: PageOpts): Promise<FeedPage> {
    const params = new URLSearchParams();
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    const query = params.toString();
    const resp = await authedFetch(`/v1/feed${query ? `?${query}` : ''}`);
    return (await resp.json()) as FeedPage;
  },

  async follow(userId: UserId): Promise<void> {
    await authedFetch(`/v1/follows/${encodeURIComponent(userId)}`, { method: 'POST' });
  },

  async unfollow(userId: UserId): Promise<void> {
    await authedFetch(`/v1/follows/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  },

  ready(): boolean {
    return adapterReady;
  },
};
