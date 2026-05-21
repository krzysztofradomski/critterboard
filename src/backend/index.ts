/**
 * Single switchboard for the backend adapter.
 *
 * Today the mock implementation resolves. Flip `USE_REMOTE_BACKEND`
 * (or back it with a feature-flag service later) to route every
 * adapter call at the Cloudflare Workers service once it ships.
 *
 * See `docs/modules/backend-adapter.md` for the full plan.
 */

import { cloudflareAdapter } from '@/backend/cloudflare';
import { mockAdapter } from '@/backend/mock';
import type { BackendAdapter } from '@/backend/adapter';

const USE_REMOTE_BACKEND = false; // flip once the Workers service is reachable

export const backend: BackendAdapter = USE_REMOTE_BACKEND
  ? cloudflareAdapter
  : mockAdapter;

export { bindMockIdentity } from '@/backend/mock';
export { mockAdapter, cloudflareAdapter };
export type { BackendAdapter, PageOpts } from '@/backend/adapter';
export {
  BackendError,
  type ActorRef,
  type BackendUser,
  type CountryCode,
  type FeedEvent,
  type FeedPage,
  type FriendNode,
  type FriendScope,
  type FriendsPage,
  type LeaderboardEntry,
  type LeaderboardPage,
  type LeaderboardScope,
  type ProfileSnapshot,
  type PublishCatchInput,
  type Relation,
  type SuggestionReason,
  type UserId,
} from '@/backend/types';
