/**
 * Critterboard API — Cloudflare Worker
 *
 * Routes:
 *   POST   /v1/auth              Exchange device UUID for JWT
 *   GET    /v1/identity          Get caller's BackendUser
 *   POST   /v1/profile           Sync profile snapshot
 *   POST   /v1/catches           Publish a catch + fan out feed events
 *   GET    /v1/leaderboard       Fetch leaderboard page (global/weekly/friends)
 *   GET    /v1/friends           Fetch friend graph page (following/followers/suggested)
 *   GET    /v1/feed              Fetch social feed from per-user Durable Object inbox
 *   POST   /v1/follows/:userId   Follow
 *   DELETE /v1/follows/:userId   Unfollow
 *
 * Storage:
 *   DB           — D1: users, follows, catches tables
 *   LEADERBOARD  — KV: cached global/weekly snapshots (refreshed by Cron every 5 min)
 *   FEED_INBOX   — Durable Object: per-user feed inbox, holds last 200 events
 *   JWT_SECRET   — Worker secret: HMAC-SHA256 signing key
 */

// ── Environment ───────────────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  LEADERBOARD: KVNamespace;
  FEED_INBOX: DurableObjectNamespace;
  JWT_SECRET: string;
  /** Comma-separated allowed origins, e.g. "https://app.critterboard.com". Defaults to '*' if unset. */
  CORS_ORIGIN?: string;
  /** Base URL of the Presidio guard-rails service, e.g. "https://presidio.example.com".
   *  When set, display names are checked for embedded PII (email, phone) before being stored.
   *  The service fails open — if Presidio is unreachable the request proceeds normally. */
  PRESIDIO_ANALYZER_URL?: string;
}

// ── Wire types (mirrors src/backend/types.ts — kept in sync by hand) ─────────

type UserId = string;
type CountryCode = string;

type BackendUser = {
  id: UserId;
  displayName: string;
  avatarEmoji?: string;
  country?: CountryCode;
  joinedAt: number;
};

type LeaderboardScope = 'global' | 'weekly' | 'friends';

type LeaderboardEntry = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  country?: CountryCode;
  xp: number;
  rank: number;
  rankDelta: number | null;
  isSelf?: boolean;
};

type LeaderboardPage = {
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  selfRank: number | null;
  totalCount: number;
  fetchedAt: number;
  nextCursor: string | null;
};

type FriendScope = 'following' | 'followers' | 'suggested';
type Relation = 'following' | 'follower' | 'mutual' | 'suggested' | 'none';

type SuggestionReason =
  | { kind: 'sharedBugs'; sharedCount: number }
  | { kind: 'nearby'; cityKey?: string }
  | { kind: 'viaFriend'; viaUserId: UserId; viaDisplayName: string };

type FriendNode = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  avatarColor?: string;
  country?: CountryCode;
  xp: number;
  rank: number | null;
  rankDelta: number | null;
  rel: Relation;
  reason?: SuggestionReason;
  lastCatch?: { bugId: string; at: number; emoji?: string };
};

type FriendsPage = {
  scope: FriendScope;
  entries: FriendNode[];
  totalCount: number;
  fetchedAt: number;
  nextCursor: string | null;
};

type ActorRef = {
  userId: UserId;
  displayName: string;
  avatarEmoji?: string;
  rel: Relation;
};

type FeedEvent =
  | { id: string; kind: 'catch'; at: number; actor: ActorRef; bugId: string; distanceM?: number }
  | { id: string; kind: 'streak'; at: number; actor: ActorRef; days: number }
  | { id: string; kind: 'badge'; at: number; actor: ActorRef; badgeId: string }
  | { id: string; kind: 'rankUp'; at: number; actor: ActorRef; from: number; to: number }
  | { id: string; kind: 'follow'; at: number; actor: ActorRef; targetUserId: UserId };

type FeedPage = {
  events: FeedEvent[];
  fetchedAt: number;
  nextCursor: string | null;
};

type ProfileSnapshot = {
  displayName: string;
  avatarEmoji?: string;
  country?: CountryCode;
  leaderboardVisible: boolean;
};

type PublishCatchInput = {
  bugId: string;
  at: number;
  lat?: number;
  lng?: number;
};

// ── D1 row shapes ─────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  country: string | null;
  xp_total: number;
  leaderboard_visible: number;
  joined_at: number;
  last_seen_at: number;
};

type WeeklyRow = {
  id: string;
  display_name: string;
  avatar_emoji: string | null;
  country: string | null;
  leaderboard_visible: number;
  xp: number;
};

// ── JWT helpers ───────────────────────────────────────────────────────────────

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlStr(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signJWT(userId: string, secret: string): Promise<string> {
  const header = b64urlStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlStr(JSON.stringify({ sub: userId, iat: now, exp: now + 7 * 24 * 3600 }));
  const unsigned = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

async function verifyJWT(token: string, secret: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sigStr] = parts as [string, string, string];
  try {
    const key = await hmacKey(secret);
    const unsigned = `${header}.${body}`;
    const sigDecoded = atob(sigStr.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = Uint8Array.from(sigDecoded, (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(unsigned));
    if (!valid) return null;
    const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
    const claims = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub: string;
      exp: number;
    };
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

// ── Response helpers ──────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function errUnauthorized(): Response {
  return json({ error: 'unauthorized' }, 401);
}

// ── Auth middleware ───────────────────────────────────────────────────────────

async function authenticate(request: Request, env: Env): Promise<string | Response> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return errUnauthorized();
  const userId = await verifyJWT(auth.slice(7), env.JWT_SECRET);
  if (!userId) return errUnauthorized();
  return userId;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function parsePage(url: URL): { offset: number; limit: number } {
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? Math.min(10_000, Math.max(0, parseInt(cursor, 10))) : 0;
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  return { offset, limit };
}

function slice<T>(list: T[], offset: number, limit: number): { items: T[]; nextCursor: string | null } {
  const items = list.slice(offset, offset + limit);
  const next = offset + items.length;
  return { items, nextCursor: next < list.length ? String(next) : null };
}

// ── Display-name moderation ───────────────────────────────────────────────────

const BLOCKED_NAME_TERMS = [
  'fuck', 'fvck', 'fucc',
  'shit',
  'cunt',
  'nigger', 'nigga',
  'faggot', 'fagot',
  'chink', 'spick', 'spic', 'wetback', 'gook', 'kike', 'beaner',
  'retard', 'tranny',
  'rape',
  'bitch', 'whore', 'slut', 'asshole', 'twat', 'wanker',
];

function normalizeForModeration(s: string): string {
  return s.toLowerCase()
    .replace(/\s+/g, '').replace(/0/g, 'o').replace(/1/g, 'i')
    .replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i')
    .replace(/\+/g, 't');
}

function isOffensiveName(name: string): boolean {
  const n = normalizeForModeration(name);
  return BLOCKED_NAME_TERMS.some((term) => n.includes(term));
}

// ── Presidio PII check ────────────────────────────────────────────────────────

/**
 * Returns true when Presidio detects high-confidence PII (email or phone) in
 * `text`.  Used to reject display names that contain real contact details.
 * Fails open: if the service is unreachable or responds with an error, returns
 * false so legitimate users are never incorrectly blocked.
 */
async function containsDisplayNamePii(text: string, presidioUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${presidioUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: 'en',
        entities: ['EMAIL_ADDRESS', 'PHONE_NUMBER'],
        score_threshold: 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const hits = (await res.json()) as Array<{ entity_type: string; score: number }>;
    return hits.length > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── XP per confirmed catch ────────────────────────────────────────────────────

const XP_PER_CATCH = 100;

// ── User row → BackendUser ────────────────────────────────────────────────────

function rowToUser(row: UserRow): BackendUser {
  const user: BackendUser = { id: row.id, displayName: row.display_name, joinedAt: row.joined_at };
  if (row.avatar_emoji) user.avatarEmoji = row.avatar_emoji;
  if (row.country) user.country = row.country;
  return user;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleAuth(request: Request, env: Env): Promise<Response> {
  // Rate-limit auth attempts to 10 per IP per minute using the LEADERBOARD KV.
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
  const rlKey = `ratelimit:auth:${ip}`;
  const rlNow = Math.floor(Date.now() / 1000);
  const rlWindow = 60;
  const rlMax = 10;
  const rl = await env.LEADERBOARD.get<{ count: number; reset: number }>(rlKey, 'json');
  if (rl && rl.reset > rlNow) {
    if (rl.count >= rlMax) return json({ error: 'too many requests' }, 429);
    await env.LEADERBOARD.put(rlKey, JSON.stringify({ count: rl.count + 1, reset: rl.reset }), { expirationTtl: rlWindow });
  } else {
    await env.LEADERBOARD.put(rlKey, JSON.stringify({ count: 1, reset: rlNow + rlWindow }), { expirationTtl: rlWindow });
  }

  const body = (await request.json()) as { userId?: unknown };
  if (typeof body.userId !== 'string' || !body.userId) return json({ error: 'userId required' }, 400);
  const userId = body.userId;
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO users (id, display_name, xp_total, leaderboard_visible, joined_at, last_seen_at)
     VALUES (?, ?, 0, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
  )
    .bind(userId, `user_${userId.slice(0, 6)}`, now, now)
    .run();

  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!row) return json({ error: 'internal error' }, 500);

  const token = await signJWT(userId, env.JWT_SECRET);
  return json({ token, user: rowToUser(row) });
}

async function handleIdentity(userId: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!row) return json({ error: 'not found' }, 404);
  return json(rowToUser(row));
}

async function handleSyncProfile(userId: string, request: Request, env: Env): Promise<Response> {
  const snap = (await request.json()) as ProfileSnapshot;
  if (typeof snap.displayName === 'string' && isOffensiveName(snap.displayName)) {
    return json({ error: 'display_name_not_allowed' }, 422);
  }
  // Enhanced PII check: reject display names that embed contact details.
  if (env.PRESIDIO_ANALYZER_URL && typeof snap.displayName === 'string') {
    const hasPii = await containsDisplayNamePii(snap.displayName, env.PRESIDIO_ANALYZER_URL);
    if (hasPii) return json({ error: 'display_name_not_allowed' }, 422);
  }
  await env.DB.prepare(
    `UPDATE users
     SET display_name = ?, avatar_emoji = ?, country = ?, leaderboard_visible = ?
     WHERE id = ?`,
  )
    .bind(snap.displayName, snap.avatarEmoji ?? null, snap.country ?? null, snap.leaderboardVisible ? 1 : 0, userId)
    .run();
  return noContent();
}

async function handlePublishCatch(userId: string, request: Request, env: Env): Promise<Response> {
  const input = (await request.json()) as PublishCatchInput;
  const catchId = crypto.randomUUID();
  const at = input.at ?? Date.now();

  await env.DB.prepare('INSERT INTO catches (id, user_id, bug_id, lat, lng, at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(catchId, userId, input.bugId, input.lat ?? null, input.lng ?? null, at)
    .run();

  await env.DB.prepare('UPDATE users SET xp_total = xp_total + ? WHERE id = ?')
    .bind(XP_PER_CATCH, userId)
    .run();

  // Invalidate KV snapshots so the next leaderboard read recomputes.
  await Promise.all([
    env.LEADERBOARD.delete('leaderboard:global'),
    env.LEADERBOARD.delete('leaderboard:weekly'),
  ]);

  // Fan out a catch event into each follower's inbox.
  const catcher = await env.DB.prepare(
    'SELECT id, display_name, avatar_emoji FROM users WHERE id = ?',
  ).bind(userId).first<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji'>>();

  if (catcher) {
    const actor: ActorRef = { userId: catcher.id, displayName: catcher.display_name, rel: 'following' };
    if (catcher.avatar_emoji) actor.avatarEmoji = catcher.avatar_emoji;

    const event: FeedEvent = { id: catchId, kind: 'catch', at, actor, bugId: input.bugId };

    const followers = await env.DB.prepare('SELECT follower_id FROM follows WHERE followee_id = ?')
      .bind(userId)
      .all<{ follower_id: string }>();

    await Promise.allSettled(
      followers.results.map((row) => {
        const stub = env.FEED_INBOX.get(env.FEED_INBOX.idFromName(row.follower_id));
        return stub.fetch('https://inbox/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
      }),
    );
  }

  return noContent();
}

async function handleLeaderboard(userId: string, url: URL, env: Env): Promise<Response> {
  const scope = (url.searchParams.get('scope') ?? 'global') as LeaderboardScope;
  const { offset, limit } = parsePage(url);

  const selfRow = await env.DB.prepare(
    'SELECT leaderboard_visible FROM users WHERE id = ?',
  ).bind(userId).first<Pick<UserRow, 'leaderboard_visible'>>();
  const selfVisible = selfRow?.leaderboard_visible === 1;

  let entries: LeaderboardEntry[];

  if (scope === 'global') {
    const cached = await env.LEADERBOARD.get<LeaderboardPage>('leaderboard:global', 'json');
    if (cached) {
      const patched = cached.entries.map((e) => (e.userId === userId ? { ...e, isSelf: true } : e));
      const { items, nextCursor } = slice(patched, offset, limit);
      const selfEntry = patched.find((e) => e.isSelf);
      return json({ ...cached, entries: items, selfRank: selfVisible ? (selfEntry?.rank ?? null) : null, nextCursor });
    }
    // Cache miss — compute from D1.
    const rows = await env.DB.prepare(
      `SELECT id, display_name, avatar_emoji, country, xp_total, leaderboard_visible
       FROM users WHERE leaderboard_visible = 1 OR id = ?
       ORDER BY xp_total DESC LIMIT 1000`,
    ).bind(userId).all<UserRow>();
    entries = buildLeaderboardEntries(rows.results, userId);
    // Cache without isSelf so it's reusable for any caller.
    const snapshot: LeaderboardPage = {
      scope: 'global',
      entries: entries.map((e) => ({ ...e, isSelf: undefined })),
      selfRank: null,
      totalCount: entries.length,
      fetchedAt: Date.now(),
      nextCursor: null,
    };
    await env.LEADERBOARD.put('leaderboard:global', JSON.stringify(snapshot), { expirationTtl: 300 });
  } else if (scope === 'weekly') {
    const weekStart = Date.now() - 7 * 24 * 3600 * 1000;
    const rows = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji, u.country, u.leaderboard_visible,
              COUNT(c.id) * ? AS xp
       FROM users u
       LEFT JOIN catches c ON c.user_id = u.id AND c.at >= ?
       WHERE u.leaderboard_visible = 1 OR u.id = ?
       GROUP BY u.id
       ORDER BY xp DESC
       LIMIT 1000`,
    ).bind(XP_PER_CATCH, weekStart, userId).all<WeeklyRow>();
    entries = rows.results.map((r, i) => {
      const e: LeaderboardEntry = {
        userId: r.id, displayName: r.display_name, xp: r.xp, rank: i + 1, rankDelta: null,
      };
      if (r.avatar_emoji) e.avatarEmoji = r.avatar_emoji;
      if (r.country) e.country = r.country;
      if (r.id === userId) e.isSelf = true;
      return e;
    });
  } else {
    // Friends scope — user + everyone they follow.
    const following = await env.DB.prepare('SELECT followee_id FROM follows WHERE follower_id = ?')
      .bind(userId).all<{ followee_id: string }>();
    const ids = [userId, ...following.results.map((r) => r.followee_id)];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await env.DB.prepare(
      `SELECT id, display_name, avatar_emoji, country, xp_total, leaderboard_visible
       FROM users WHERE id IN (${placeholders})
       ORDER BY xp_total DESC`,
    ).bind(...ids).all<UserRow>();
    entries = buildLeaderboardEntries(
      rows.results.filter((r) => r.leaderboard_visible === 1 || r.id === userId),
      userId,
    );
  }

  const { items, nextCursor } = slice(entries, offset, limit);
  const selfEntry = entries.find((e) => e.isSelf);
  return json({
    scope,
    entries: items,
    selfRank: selfVisible ? (selfEntry?.rank ?? null) : null,
    totalCount: entries.length,
    fetchedAt: Date.now(),
    nextCursor,
  } satisfies LeaderboardPage);
}

function buildLeaderboardEntries(rows: UserRow[], selfId: string): LeaderboardEntry[] {
  return rows.map((r, i) => {
    const e: LeaderboardEntry = { userId: r.id, displayName: r.display_name, xp: r.xp_total, rank: i + 1, rankDelta: null };
    if (r.avatar_emoji) e.avatarEmoji = r.avatar_emoji;
    if (r.country) e.country = r.country;
    if (r.id === selfId) e.isSelf = true;
    return e;
  });
}

async function handleFriends(userId: string, url: URL, env: Env): Promise<Response> {
  const scope = (url.searchParams.get('scope') ?? 'following') as FriendScope;
  const { offset, limit } = parsePage(url);

  let nodes: FriendNode[];

  if (scope === 'following') {
    const rows = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji, u.country, u.xp_total
       FROM follows f JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = ? ORDER BY u.xp_total DESC`,
    ).bind(userId).all<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji' | 'country' | 'xp_total'>>();
    nodes = rows.results.map((r) => friendNode(r, 'following'));
  } else if (scope === 'followers') {
    const rows = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji, u.country, u.xp_total,
              (SELECT 1 FROM follows f2 WHERE f2.follower_id = ? AND f2.followee_id = u.id) AS i_follow
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = ? ORDER BY u.xp_total DESC`,
    ).bind(userId, userId).all<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji' | 'country' | 'xp_total'> & { i_follow: 1 | null }>();
    nodes = rows.results.map((r) => friendNode(r, r.i_follow ? 'mutual' : 'follower'));
  } else {
    // Suggested: not already followed, ranked by popularity (follower count).
    const rows = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji, u.country, u.xp_total,
              COUNT(f2.follower_id) AS follower_count
       FROM users u
       LEFT JOIN follows f2 ON f2.followee_id = u.id
       WHERE u.id != ?
         AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = u.id)
       GROUP BY u.id
       ORDER BY follower_count DESC, u.xp_total DESC
       LIMIT 50`,
    ).bind(userId, userId).all<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji' | 'country' | 'xp_total'>>();
    nodes = rows.results.map((r) => ({
      ...friendNode(r, 'suggested'),
      reason: { kind: 'sharedBugs', sharedCount: 1 } as SuggestionReason,
    }));
  }

  const { items, nextCursor } = slice(nodes, offset, limit);
  return json({ scope, entries: items, totalCount: nodes.length, fetchedAt: Date.now(), nextCursor } satisfies FriendsPage);
}

function friendNode(
  r: Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji' | 'country' | 'xp_total'>,
  rel: Relation,
): FriendNode {
  const n: FriendNode = { userId: r.id, displayName: r.display_name, xp: r.xp_total, rank: null, rankDelta: null, rel };
  if (r.avatar_emoji) n.avatarEmoji = r.avatar_emoji;
  if (r.country) n.country = r.country;
  return n;
}

async function handleFeed(userId: string, url: URL, env: Env): Promise<Response> {
  const params = new URLSearchParams();
  const cursor = url.searchParams.get('cursor');
  const limitStr = url.searchParams.get('limit');
  if (cursor) params.set('cursor', cursor);
  if (limitStr) params.set('limit', limitStr);

  const stub = env.FEED_INBOX.get(env.FEED_INBOX.idFromName(userId));
  return stub.fetch(`https://inbox/read?${params}`);
}

async function handleFollow(callerId: string, targetId: string, env: Env): Promise<Response> {
  if (callerId === targetId) return json({ error: 'cannot follow self' }, 400);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT DO NOTHING`,
  ).bind(callerId, targetId, now).run();

  // Notify the target's inbox.
  const caller = await env.DB.prepare('SELECT id, display_name, avatar_emoji FROM users WHERE id = ?')
    .bind(callerId).first<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji'>>();
  if (caller) {
    const actor: ActorRef = { userId: caller.id, displayName: caller.display_name, rel: 'following' };
    if (caller.avatar_emoji) actor.avatarEmoji = caller.avatar_emoji;
    const event: FeedEvent = {
      id: `follow-${callerId}-${targetId}-${now}`,
      kind: 'follow',
      at: now,
      actor,
      targetUserId: targetId,
    };
    const stub = env.FEED_INBOX.get(env.FEED_INBOX.idFromName(targetId));
    await stub.fetch('https://inbox/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }

  return noContent();
}

async function handleUnfollow(callerId: string, targetId: string, env: Env): Promise<Response> {
  await env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?')
    .bind(callerId, targetId).run();
  return noContent();
}

// ── Cron — refresh KV leaderboard snapshot ────────────────────────────────────

async function refreshLeaderboardCache(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT id, display_name, avatar_emoji, country, xp_total, leaderboard_visible
     FROM users WHERE leaderboard_visible = 1
     ORDER BY xp_total DESC LIMIT 1000`,
  ).all<UserRow>();

  const entries: LeaderboardEntry[] = rows.results.map((r, i) => {
    const e: LeaderboardEntry = { userId: r.id, displayName: r.display_name, xp: r.xp_total, rank: i + 1, rankDelta: null };
    if (r.avatar_emoji) e.avatarEmoji = r.avatar_emoji;
    if (r.country) e.country = r.country;
    return e;
  });

  const page: LeaderboardPage = {
    scope: 'global',
    entries,
    selfRank: null,
    totalCount: entries.length,
    fetchedAt: Date.now(),
    nextCursor: null,
  };

  await env.LEADERBOARD.put('leaderboard:global', JSON.stringify(page), { expirationTtl: 3600 });
}

// ── Durable Object — FeedInbox ────────────────────────────────────────────────

export class FeedInbox implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/append') {
      const event = (await request.json()) as FeedEvent;
      const events: FeedEvent[] = (await this.state.storage.get<FeedEvent[]>('events')) ?? [];
      events.unshift(event);
      if (events.length > 200) events.length = 200;
      await this.state.storage.put('events', events);
      return new Response(null, { status: 204 });
    }

    if (request.method === 'GET' && url.pathname === '/read') {
      const offset = Math.max(0, parseInt(url.searchParams.get('cursor') ?? '0', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
      const events: FeedEvent[] = (await this.state.storage.get<FeedEvent[]>('events')) ?? [];
      const { items, nextCursor } = slice(events, offset, limit);
      return Response.json({ events: items, fetchedAt: Date.now(), nextCursor } satisfies FeedPage);
    }

    return new Response('not found', { status: 404 });
  }
}

// ── CORS origin helper ────────────────────────────────────────────────────────

function resolveOrigin(request: Request, env: Env): string {
  const configured = env.CORS_ORIGIN;
  if (!configured) return '*';
  const reqOrigin = request.headers.get('Origin') ?? '';
  const allowed = configured.split(',').map((s) => s.trim());
  return allowed.includes(reqOrigin) ? reqOrigin : (allowed[0] ?? '*');
}

function applyOrigin(response: Response, request: Request, env: Env): Response {
  const origin = resolveOrigin(request, env);
  if (origin === '*') return response; // static header already set to '*'
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// ── Main export ───────────────────────────────────────────────────────────────

async function routeRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const { pathname: path, method } = { pathname: url.pathname, method: request.method };

  if (method === 'POST' && path === '/v1/auth') return handleAuth(request, env);

  const authResult = await authenticate(request, env);
  if (authResult instanceof Response) return authResult;
  const userId = authResult;

  if (method === 'GET'  && path === '/v1/identity')   return handleIdentity(userId, env);
  if (method === 'POST' && path === '/v1/profile')    return handleSyncProfile(userId, request, env);
  if (method === 'POST' && path === '/v1/catches')    return handlePublishCatch(userId, request, env);
  if (method === 'GET'  && path === '/v1/leaderboard') return handleLeaderboard(userId, url, env);
  if (method === 'GET'  && path === '/v1/friends')    return handleFriends(userId, url, env);
  if (method === 'GET'  && path === '/v1/feed')       return handleFeed(userId, url, env);

  const followMatch = /^\/v1\/follows\/([a-zA-Z0-9_-]{1,128})$/.exec(path);
  if (followMatch) {
    const targetId = followMatch[1]!;
    if (method === 'POST')   return handleFollow(userId, targetId, env);
    if (method === 'DELETE') return handleUnfollow(userId, targetId, env);
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routeRequest(request, env);
    return applyOrigin(response, request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await refreshLeaderboardCache(env);
  },
};
