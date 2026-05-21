/**
 * Cloudflare backend adapter — placeholder.
 *
 * Throws on every call today. Flip `USE_REMOTE_BACKEND` in
 * `src/backend/index.ts` once the Workers service is reachable.
 *
 * Planned wiring (see `docs/decisions/002-backend-adapter-seam.md` and
 * `docs/modules/backend-adapter.md`):
 *
 *   - **Worker entrypoint.** Single Worker fronting routes like
 *     `GET /v1/leaderboard?scope=global`, `POST /v1/catches`,
 *     `POST /v1/follows`, `GET /v1/feed`.
 *
 *   - **Storage.** D1 for the user table + follow edges (relational
 *     queries for "friends of friends" suggestions); a Durable Object
 *     per user for the personalized feed inbox; KV for the cached
 *     global leaderboard snapshot (recomputed every N minutes).
 *
 *   - **Auth.** Bearer token derived from the local `backendUserId`
 *     (a UUID v4 generated on first launch). The Worker mints a signed
 *     JWT on the first call so subsequent calls don't have to round-trip
 *     the raw id.
 *
 *   - **Privacy.** Same opt-in posture as crash reporting: nothing
 *     leaves the device unless `profile.networkOn` is on. The hook
 *     layer is the chokepoint — `cloudflareAdapter` itself is unaware
 *     of the toggle.
 *
 *   - **Rate limits.** Worker uses CF's `cf.rateLimiting` per
 *     userId. Adapter surfaces 429 as `BackendError('rate-limited')`.
 */

import type { BackendAdapter } from '@/backend/adapter';
import { BackendError } from '@/backend/types';

function notWired(method: string): never {
  throw new BackendError(
    'unavailable',
    `cloudflareAdapter.${method} not wired yet. ` +
      'Deploy the Worker, set EXPO_PUBLIC_BACKEND_URL, then flip USE_REMOTE_BACKEND in src/backend/index.ts.',
  );
}

export const cloudflareAdapter: BackendAdapter = {
  async identity() {
    return notWired('identity');
  },
  async syncProfile() {
    return notWired('syncProfile');
  },
  async publishCatch() {
    return notWired('publishCatch');
  },
  async fetchLeaderboard() {
    return notWired('fetchLeaderboard');
  },
  async fetchFriends() {
    return notWired('fetchFriends');
  },
  async fetchFeed() {
    return notWired('fetchFeed');
  },
  async follow() {
    return notWired('follow');
  },
  async unfollow() {
    return notWired('unfollow');
  },
  ready() {
    return false;
  },
};
