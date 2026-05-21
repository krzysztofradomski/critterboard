/**
 * Backend wire types — schemas for every payload that crosses the
 * adapter seam (see `src/backend/adapter.ts`). Today both endpoints
 * resolve to the in-process mock; the same shapes will travel over
 * HTTPS to Cloudflare Workers once the real service ships.
 *
 * Design constraints:
 *
 *  1. **Account-less.** There is no email/phone/OAuth handshake. Each
 *     install generates one opaque `userId` (UUID v4) at first launch
 *     and stores it locally. Lose the device → lose the identity.
 *     `wipeAll` rotates the id so a fresh install is genuinely fresh.
 *
 *  2. **Display-name is mutable.** The server never assumes
 *     `displayName` is unique or stable. UI lookups always go through
 *     `userId`. Renames propagate via `setDisplayName`.
 *
 *  3. **Mocked first.** Every field is shaped so the mock adapter can
 *     populate it deterministically from existing static seeds
 *     (`src/data/leaderboard.ts`, `src/data/personProfiles.ts`).
 *
 *  4. **Forward-compatible cursors.** Pagination is opaque-cursor based
 *     (`nextCursor: string | null`) rather than offset/limit so the
 *     server can switch between scan strategies (KV scan, D1 ROWID,
 *     Durable Object stream) without UI churn.
 */

/** Stable, server-owned user identity. Opaque to the UI. */
export type UserId = string;

/** ISO 3166-1 alpha-2. `'private'` when the user hides their location. */
export type CountryCode = string;

/** Coarse user record. Returned by `identity()` and embedded in actor refs. */
export type BackendUser = {
  id: UserId;
  displayName: string;
  /** Emoji avatar. Mirrors the local profile sticker. */
  avatarEmoji?: string;
  /** Two-letter country code, or `'private'` when location share is off. */
  country?: CountryCode;
  /** Epoch ms of first publish (server-stamped). */
  joinedAt: number;
};

// ──────────────────────────────────────────────────────────────────────────
// Leaderboard
// ──────────────────────────────────────────────────────────────────────────

export type LeaderboardScope = 'global' | 'weekly' | 'friends';

export type LeaderboardEntry = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  country?: CountryCode;
  /** Total XP for the scope. For `'weekly'` this is the week's delta only. */
  xp: number;
  /** 1-indexed rank within the returned page's scope. */
  rank: number;
  /**
   * Rank change since the previous period (negative = climbed). `null`
   * when there's no baseline yet (new user, new week).
   */
  rankDelta: number | null;
  /** True if this row represents the calling user. */
  isSelf?: boolean;
};

export type LeaderboardPage = {
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  /**
   * The caller's rank within the full scope (may sit far below the
   * returned `entries` window). `null` when the user is hidden
   * (`leaderboardOn === false` server-side).
   */
  selfRank: number | null;
  /** Best-effort total trainer count in scope, for the header copy. */
  totalCount: number;
  /** Epoch ms when the server computed this snapshot. */
  fetchedAt: number;
  /** Opaque cursor for the next page. `null` when there is none. */
  nextCursor: string | null;
};

// ──────────────────────────────────────────────────────────────────────────
// Friend graph
// ──────────────────────────────────────────────────────────────────────────

export type FriendScope = 'following' | 'followers' | 'suggested';

export type Relation = 'following' | 'follower' | 'mutual' | 'suggested' | 'none';

/**
 * Suggestion provenance. Translation keys live under `person.why.*` in
 * the bundled i18n packs (`viaFriend` is parameterized; the rest are
 * leaf strings).
 */
export type SuggestionReason =
  | { kind: 'sharedBugs'; sharedCount: number }
  | { kind: 'nearby'; cityKey?: string }
  | { kind: 'viaFriend'; viaUserId: UserId; viaDisplayName: string };

export type FriendNode = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  /** Hex color or PB token name. Mock uses the existing peer palette. */
  avatarColor?: string;
  country?: CountryCode;
  xp: number;
  /** Global rank at last snapshot. May be null for the long tail. */
  rank: number | null;
  /**
   * Rank delta since the previous snapshot. `null` when there's no
   * baseline. Negative = climbed up.
   */
  rankDelta: number | null;
  rel: Relation;
  /** Populated only when `scope === 'suggested'`. */
  reason?: SuggestionReason;
  /** Most recent public catch, for the friends-list snippet. */
  lastCatch?: { bugId: string; at: number; emoji?: string };
};

export type FriendsPage = {
  scope: FriendScope;
  entries: FriendNode[];
  totalCount: number;
  fetchedAt: number;
  nextCursor: string | null;
};

// ──────────────────────────────────────────────────────────────────────────
// Social feed — events from other users
// ──────────────────────────────────────────────────────────────────────────

/** Minimal embedded user reference for feed events. */
export type ActorRef = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  /** The caller's relation to this actor at fetch time. */
  rel: Relation;
};

/**
 * Discriminated union of every kind of social event the server can
 * surface. Adding a new kind here is a forward-compatible change — the
 * UI's switch falls through to a generic renderer for unknown kinds.
 */
export type FeedEvent =
  | {
      id: string;
      kind: 'catch';
      at: number;
      actor: ActorRef;
      bugId: string;
      /** Coarse distance in metres, if both parties share location. */
      distanceM?: number;
    }
  | {
      id: string;
      kind: 'streak';
      at: number;
      actor: ActorRef;
      days: number;
    }
  | {
      id: string;
      kind: 'badge';
      at: number;
      actor: ActorRef;
      badgeId: string;
    }
  | {
      id: string;
      kind: 'rankUp';
      at: number;
      actor: ActorRef;
      /** Old → new global rank. */
      from: number;
      to: number;
    }
  | {
      id: string;
      kind: 'follow';
      at: number;
      /** The user who initiated the follow. */
      actor: ActorRef;
      /** Always the calling user — handy if the UI wants to dedupe. */
      targetUserId: UserId;
    };

export type FeedPage = {
  events: FeedEvent[];
  fetchedAt: number;
  nextCursor: string | null;
};

// ──────────────────────────────────────────────────────────────────────────
// Write payloads
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-catch event sent to the server. The server is responsible for
 * computing XP — the client never sends an authoritative XP delta, only
 * the underlying action. This keeps anti-cheat in one place.
 */
export type PublishCatchInput = {
  /** Matches an `id` in `src/data/bugs.ts`. */
  bugId: string;
  /** Client-side capture timestamp (epoch ms). */
  at: number;
  /**
   * Coarse GPS for "nearby catches" feed event. Only sent when the
   * user has `locationShareOn`. Caller is responsible for honouring
   * the toggle — the adapter trusts the value as-is.
   */
  lat?: number;
  lng?: number;
};

/**
 * Snapshot of the caller's identity-visible state. Sent on every
 * meaningful local change (display name edit, location share toggle,
 * leaderboard visibility flip) so the server can mirror it. Keeping
 * this as one method instead of N setters keeps the wire surface tiny.
 */
export type ProfileSnapshot = {
  displayName: string;
  avatarEmoji?: string;
  country?: CountryCode;
  /**
   * When false the server hides the user from public leaderboards and
   * from the social feed of users they don't follow back.
   */
  leaderboardVisible: boolean;
};

// ──────────────────────────────────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────────────────────────────────

/**
 * The single error class for adapter calls. Adapters classify failures
 * coarsely; the hook layer turns them into UI states. Sticking to one
 * class keeps catch sites tight on the consumer side.
 */
export class BackendError extends Error {
  readonly kind: 'offline' | 'unavailable' | 'rate-limited' | 'unknown';

  constructor(kind: BackendError['kind'], message: string) {
    super(message);
    this.kind = kind;
    this.name = 'BackendError';
  }
}
