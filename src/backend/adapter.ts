/**
 * Backend adapter seam.
 *
 * One interface, two implementations behind it:
 *
 *  1. `mockAdapter` — today's default. In-process, synthesized from
 *     the existing static seeds (`src/data/leaderboard.ts`,
 *     `src/data/personProfiles.ts`) plus a deterministic peer-activity
 *     ticker so the social feed has fresh content on every fetch.
 *
 *  2. `cloudflareAdapter` — placeholder. Will wrap a Cloudflare
 *     Workers + D1/Durable Objects service. Throws on every call today;
 *     flip `USE_REMOTE_BACKEND` in `src/backend/index.ts` once the
 *     service is reachable.
 *
 * The TS surface is identical. Swap is one line in `index.ts`.
 *
 * Every method:
 *
 *  - Is `async`. Even the mock awaits a tiny artificial delay so the
 *    loading states in the hooks layer have time to render.
 *  - Throws `BackendError` (never a raw `Error`) so the hook layer can
 *    classify failures (`offline` / `unavailable` / `rate-limited`).
 *  - Is idempotent where the wire shape allows (follow/unfollow are
 *    safe to call when already in/out of state).
 */

import type {
  BackendUser,
  FeedPage,
  FriendScope,
  FriendsPage,
  LeaderboardPage,
  LeaderboardScope,
  ProfileSnapshot,
  PublishCatchInput,
  UserId,
} from '@/backend/types';

/** Cursor + limit pagination opts. Both fields optional. */
export type PageOpts = {
  /** Opaque cursor from a previous `nextCursor`. Omit for first page. */
  cursor?: string;
  /** Soft cap on entries. Adapters may return fewer. Default 20. */
  limit?: number;
};

export interface BackendAdapter {
  /**
   * Resolve the caller's stable identity. The mock derives it from the
   * persisted `backendUserId` slice; the real adapter exchanges the
   * device-local id for a server-issued record on first call.
   */
  identity(): Promise<BackendUser>;

  /**
   * Push a profile snapshot to the server. Safe to call on every
   * change — adapters are responsible for debouncing/coalescing.
   */
  syncProfile(snapshot: ProfileSnapshot): Promise<void>;

  /**
   * Record a catch on the server. Server computes XP, fans out feed
   * events to followers, and refreshes leaderboard rank. UI doesn't
   * await fan-out — fire-and-forget after the local write.
   */
  publishCatch(input: PublishCatchInput): Promise<void>;

  /**
   * Fetch one page of a leaderboard scope. `'friends'` is computed
   * server-side against the caller's follow set.
   */
  fetchLeaderboard(
    scope: LeaderboardScope,
    opts?: PageOpts,
  ): Promise<LeaderboardPage>;

  /** Fetch one page of the friend graph for the requested scope. */
  fetchFriends(scope: FriendScope, opts?: PageOpts): Promise<FriendsPage>;

  /**
   * Fetch one page of the social feed (events from other users). The
   * mock returns a deterministic mix of follow-graph events; the real
   * adapter returns whatever the server's feed ranker decides.
   */
  fetchFeed(opts?: PageOpts): Promise<FeedPage>;

  /** Follow a user. Idempotent. */
  follow(userId: UserId): Promise<void>;

  /** Unfollow a user. Idempotent. */
  unfollow(userId: UserId): Promise<void>;

  /**
   * `true` once the adapter is warm and reachable. The mock is always
   * ready; the real adapter returns `false` until the first successful
   * `identity()` round-trip.
   */
  ready(): boolean;
}
