/**
 * Mock backend adapter.
 *
 * In-process, single-instance. Synthesizes the wire types from the
 * existing static seeds so the UI behaves identically whether the real
 * Cloudflare adapter is wired or not:
 *
 *   - Leaderboard rows come from `src/data/leaderboard.ts` plus the
 *     caller's live XP slot.
 *   - Friend nodes come from `src/data/personProfiles.ts`.
 *   - Suggested feed events are generated deterministically from the
 *     follow graph — each followed peer "catches" a bug every few
 *     hours, hashed off `userId × hour`, so the feed has fresh content
 *     between fetches without a server.
 *
 * Identity is supplied by the consumer at bind time
 * (`bindMockIdentity`) so the adapter doesn't reach back into the
 * Zustand store. This keeps the file importable from non-React
 * contexts (tests, codemods).
 */

import { BUGS } from '@/data/bugs';
import { LEADERS } from '@/data/leaderboard';
import { FRIENDS, PERSON_PROFILES } from '@/data/personProfiles';

import type { BackendAdapter, PageOpts } from '@/backend/adapter';
import {
  BackendError,
  type ActorRef,
  type BackendUser,
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
  type UserId,
} from '@/backend/types';

// ──────────────────────────────────────────────────────────────────────────
// Identity binding
// ──────────────────────────────────────────────────────────────────────────

/**
 * What the mock needs to know about the caller. The consumer
 * (typically the React hook layer) injects this via `bindMockIdentity`
 * so the mock stays decoupled from Zustand.
 */
export type MockSelf = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  country?: string;
  /** Live XP for the user's leaderboard slot. */
  xp: number;
  /** Server-visible follow set. */
  followed: ReadonlySet<UserId>;
  /** When false the user is hidden from leaderboard/feed. */
  leaderboardVisible: boolean;
};

type SelfFn = () => MockSelf | null;
let getSelf: SelfFn = () => null;

/**
 * Inject the live-self provider. Call once at app boot from the React
 * layer. Subsequent reads are lazy — the mock pulls fresh state on
 * every adapter call.
 */
export function bindMockIdentity(fn: SelfFn): void {
  getSelf = fn;
}

/**
 * Throws a `BackendError` if no identity has been bound. Real adapters
 * would 401; the mock surfaces an `unavailable` so the hook layer can
 * render the "set up your profile" path.
 */
function requireSelf(): MockSelf {
  const self = getSelf();
  if (!self) {
    throw new BackendError(
      'unavailable',
      'mockAdapter has no identity bound — call bindMockIdentity() first',
    );
  }
  return self;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/** Tiny artificial latency. Keeps loading states visible in dev. */
const MOCK_DELAY_MS = 120;
const DEFAULT_PAGE = 20;

function delay(ms = MOCK_DELAY_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Cheap stable hash. Used to spread synthetic peer activity across the
 * day deterministically so the feed doesn't shuffle on every fetch.
 */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

function parseCursor(c: string | undefined): number {
  if (!c) return 0;
  const n = Number.parseInt(c, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function paginate<T>(
  list: T[],
  opts: PageOpts | undefined,
): { slice: T[]; nextCursor: string | null } {
  const offset = parseCursor(opts?.cursor);
  const limit = Math.max(1, Math.min(100, opts?.limit ?? DEFAULT_PAGE));
  const slice = list.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  return {
    slice,
    nextCursor: nextOffset < list.length ? String(nextOffset) : null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Peer registry — projects static seeds onto the wire types
// ──────────────────────────────────────────────────────────────────────────

/**
 * Map the static `LEADERS` and `FRIENDS` rows onto a single keyed-by-id
 * peer registry. In the mock the `userId` is the display name; the
 * real adapter would issue UUIDs.
 */
const PEERS: Map<UserId, BackendUser & { xp: number; rank: number | null }> = (() => {
  const m = new Map<UserId, BackendUser & { xp: number; rank: number | null }>();
  for (const row of LEADERS) {
    if (row.self) continue;
    m.set(row.name, {
      id: row.name,
      displayName: row.name,
      country: row.country,
      joinedAt: Date.now() - 365 * 24 * 3600 * 1000,
      xp: row.xp,
      rank: row.rank,
    });
  }
  for (const row of FRIENDS) {
    const existing = m.get(row.name);
    if (existing) continue;
    m.set(row.name, {
      id: row.name,
      displayName: row.name,
      avatarEmoji: row.emoji,
      country: row.country,
      joinedAt: Date.now() - 365 * 24 * 3600 * 1000,
      xp: row.xp,
      rank: row.rank,
    });
  }
  return m;
})();

/** Mock-local follow-graph mirror. Mirrors the live `followed` set. */
function relationFor(targetId: UserId, self: MockSelf): Relation {
  const iFollow = self.followed.has(targetId);
  // The mock treats every peer in the seeded `INITIAL_FOLLOWED` set as
  // also following the caller back — keeps the friends UX populated.
  // The real server would compute this from the actual edge.
  const followsMe = self.followed.has(targetId);
  if (iFollow && followsMe) return 'mutual';
  if (iFollow) return 'following';
  if (followsMe) return 'follower';
  return 'none';
}

function actorFor(peerId: UserId, self: MockSelf): ActorRef {
  const peer = PEERS.get(peerId);
  const displayName = peer?.displayName ?? peerId;
  const avatarEmoji = peer?.avatarEmoji;
  const rel = relationFor(peerId, self);
  const out: ActorRef = { userId: peerId, displayName, rel };
  if (avatarEmoji) out.avatarEmoji = avatarEmoji;
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Synthetic feed generator
// ──────────────────────────────────────────────────────────────────────────

/**
 * Generate one feed event per followed peer per ~hour. The bug picked
 * is hashed off `(peerId × hourBucket)` so it stays stable within an
 * hour, then advances. Includes occasional streak/badge/rankUp events
 * for variety.
 */
function generateFeed(self: MockSelf, now: number): FeedEvent[] {
  const events: FeedEvent[] = [];
  const HOUR = 3600 * 1000;
  const followed = Array.from(self.followed);

  for (const peerId of followed) {
    const peer = PEERS.get(peerId);
    if (!peer) continue;
    // Emit one event per peer per hour for the last ~24h. Lookback
    // capped so the page stays scannable; pagination walks deeper.
    for (let hoursAgo = 0; hoursAgo < 24; hoursAgo++) {
      const bucket = Math.floor((now - hoursAgo * HOUR) / HOUR);
      const seed = hashStr(`${peerId}|${bucket}`);
      // Only ~1/3 of buckets emit, so the feed isn't a fire-hose.
      if (seed % 3 !== 0) continue;

      const at = now - hoursAgo * HOUR - (seed % HOUR);
      const kindRoll = seed % 32;
      const actor = actorFor(peerId, self);

      if (kindRoll === 0) {
        events.push({
          id: `${peerId}-streak-${bucket}`,
          kind: 'streak',
          at,
          actor,
          days: 3 + (seed % 28),
        });
      } else if (kindRoll === 1) {
        const newRank = Math.max(1, (peer.rank ?? 50) - 1 - (seed % 3));
        events.push({
          id: `${peerId}-rank-${bucket}`,
          kind: 'rankUp',
          at,
          actor,
          from: newRank + 1 + (seed % 3),
          to: newRank,
        });
      } else if (kindRoll === 2) {
        events.push({
          id: `${peerId}-badge-${bucket}`,
          kind: 'badge',
          at,
          actor,
          badgeId: `b${1 + (seed % 6)}`,
        });
      } else {
        const bug = BUGS[seed % BUGS.length]!;
        events.push({
          id: `${peerId}-catch-${bucket}`,
          kind: 'catch',
          at,
          actor,
          bugId: bug.id,
          distanceM: 100 + (seed % 5000),
        });
      }
    }
  }

  // Newest first.
  events.sort((a, b) => b.at - a.at);
  return events;
}

// ──────────────────────────────────────────────────────────────────────────
// Adapter implementation
// ──────────────────────────────────────────────────────────────────────────

let lastProfile: ProfileSnapshot | null = null;

export const mockAdapter: BackendAdapter = {
  async identity(): Promise<BackendUser> {
    await delay();
    const self = requireSelf();
    const out: BackendUser = {
      id: self.userId,
      displayName: self.displayName,
      joinedAt: Date.now(),
    };
    if (self.avatarEmoji) out.avatarEmoji = self.avatarEmoji;
    if (self.country) out.country = self.country;
    return out;
  },

  async syncProfile(snapshot) {
    await delay(40);
    lastProfile = snapshot;
  },

  async publishCatch(_input: PublishCatchInput) {
    await delay(40);
    // The mock has nothing durable to write — the local store already
    // captured the catch. A real server would fan out feed events here.
  },

  async fetchLeaderboard(scope, opts) {
    await delay();
    const self = requireSelf();

    const baseEntries: LeaderboardEntry[] = LEADERS.map((row) => {
      const isSelf = !!row.self;
      const xp = isSelf ? self.xp : row.xp;
      const userId = isSelf ? self.userId : row.name;
      const displayName = isSelf ? self.displayName : row.name;
      const country = isSelf
        ? self.country ?? 'private'
        : row.country;
      const entry: LeaderboardEntry = {
        userId,
        displayName,
        xp,
        rank: row.rank,
        country,
        rankDelta: null,
      };
      if (isSelf) entry.isSelf = true;
      return entry;
    });

    // Re-sort by xp desc and renumber.
    const sorted = [...baseEntries]
      .sort((a, b) => b.xp - a.xp)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    let filtered: LeaderboardEntry[];
    if (scope === 'friends') {
      filtered = sorted.filter(
        (e) => e.isSelf || self.followed.has(e.userId),
      );
    } else if (scope === 'weekly') {
      // Weekly = a deterministic 30% slice of total xp, so the ordering
      // can drift from global. Plenty for the UI to look "different".
      filtered = sorted
        .map((e) => ({
          ...e,
          xp: Math.round(e.xp * (0.2 + ((hashStr(e.userId) % 1000) / 1000) * 0.4)),
        }))
        .sort((a, b) => b.xp - a.xp)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    } else {
      filtered = sorted;
    }

    if (!self.leaderboardVisible) {
      filtered = filtered.filter((e) => !e.isSelf);
    }

    const { slice, nextCursor } = paginate(filtered, opts);
    const selfEntry = filtered.find((e) => e.isSelf);
    return {
      scope,
      entries: slice,
      selfRank: selfEntry ? selfEntry.rank : null,
      totalCount: filtered.length,
      fetchedAt: Date.now(),
      nextCursor,
    };
  },

  async fetchFriends(scope, opts) {
    await delay();
    const self = requireSelf();

    const all: FriendNode[] = FRIENDS.map((row) => {
      const profile = PERSON_PROFILES[row.name];
      const node: FriendNode = {
        userId: row.name,
        displayName: row.name,
        avatarEmoji: row.emoji,
        avatarColor: row.color,
        country: row.country,
        xp: row.xp,
        rank: row.rank,
        rankDelta: row.delta == null ? null : Number.parseInt(row.delta, 10) || 0,
        rel: relationFor(row.name, self),
        lastCatch: {
          bugId: profile?.recent[0] ?? 'mona',
          at: Date.now() - hashStr(row.name) % (24 * 3600 * 1000),
          emoji: row.catchEmoji,
        },
      };
      if (row.whyKey === 'sharedBugs') {
        node.reason = { kind: 'sharedBugs', sharedCount: 4 };
      } else if (row.whyKey === 'brooklyn') {
        node.reason = { kind: 'nearby', cityKey: 'brooklyn' };
      } else if (row.whyKey === 'viaMothwhisperer') {
        node.reason = {
          kind: 'viaFriend',
          viaUserId: 'mothwhisperer',
          viaDisplayName: 'mothwhisperer',
        };
      }
      return node;
    });

    let filtered: FriendNode[];
    if (scope === 'following') {
      filtered = all.filter((n) => self.followed.has(n.userId));
    } else if (scope === 'followers') {
      // Mock treats seeded "follower" rows + everyone I follow as
      // mutual followers (the real server would compute this).
      filtered = all.filter(
        (n) => self.followed.has(n.userId) || n.rel === 'follower',
      );
    } else {
      filtered = all.filter((n) => !self.followed.has(n.userId) && !!n.reason);
    }

    const { slice, nextCursor } = paginate(filtered, opts);
    return {
      scope,
      entries: slice,
      totalCount: filtered.length,
      fetchedAt: Date.now(),
      nextCursor,
    };
  },

  async fetchFeed(opts) {
    await delay();
    const self = requireSelf();
    const events = generateFeed(self, Date.now());
    const { slice, nextCursor } = paginate(events, opts);
    return {
      events: slice,
      fetchedAt: Date.now(),
      nextCursor,
    };
  },

  async follow(_userId) {
    await delay(40);
    // The local `followed` set is the source of truth; the mock simply
    // accepts the write. Real adapter would POST to the server.
  },

  async unfollow(_userId) {
    await delay(40);
  },

  ready() {
    return true;
  },
};

/** Test-only: snapshot the last profile sync the mock received. */
export function __mockLastProfile(): ProfileSnapshot | null {
  return lastProfile;
}
