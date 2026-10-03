/**
 * Critterboard API — Cloudflare Worker
 *
 * Routes:
 *   POST   /v1/auth              Exchange { userId, secret } for a JWT (secret proves ownership of the public id)
 *   GET    /v1/identity          Get caller's BackendUser
 *   POST   /v1/profile           Sync profile snapshot
 *   POST   /v1/catches           Publish a catch + fan out feed events
 *   POST   /v1/catches/batch     Upload older catches (idempotent, no fan-out)
 *   DELETE /v1/catches/locations Clear the stored coordinates of every catch
 *   DELETE /v1/account           Delete the user and everything stored for them
 *   GET    /v1/leaderboard       Fetch leaderboard page (global/weekly/friends)
 *   GET    /v1/friends           Fetch friend graph page (following/followers/suggested)
 *   GET    /v1/feed              Fetch social feed from per-user Durable Object inbox
 *   GET    /v1/sightings/nearby  Other players' shared catches nearest to ?lat&lng (anonymous)
 *   POST   /v1/follows/:userId   Follow
 *   DELETE /v1/follows/:userId   Unfollow
 *
 * Storage:
 *   DB           — D1: users, follows, catches tables
 *   LEADERBOARD  — KV: cached global/weekly snapshots (refreshed by Cron every 5 min)
 *   FEED_INBOX   — Durable Object: per-user feed inbox, holds last 200 events
 *   JWT_SECRET   — Worker secret: HMAC-SHA256 signing key
 */

import { SPECIES_XP } from './speciesXp';

// ── Environment ───────────────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  LEADERBOARD: KVNamespace;
  FEED_INBOX: DurableObjectNamespace;
  JWT_SECRET: string;
  /** Workers Rate Limiting: POST /v1/auth, keyed by client IP. */
  AUTH_LIMITER: RateLimit;
  /** Workers Rate Limiting: every authenticated call, keyed by user id. */
  API_LIMITER: RateLimit;
  /** Comma-separated allowed origins, e.g. "https://app.critterboard.com". Defaults to '*' if unset. */
  CORS_ORIGIN?: string;
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

// ── XP ────────────────────────────────────────────────────────────────────────
// Leaderboard XP is computed here, never sent by the client: each distinct species a user
// has caught is worth its listed XP once (the same rule as the app's Dex).

/**
 * XP for one species. An id the table doesn't know scores nothing, so made-up ids can't
 * farm XP. Its catches are still stored: once the worker ships a table that lists the
 * species, the next recompute counts them.
 */
const xpFor = (bugId: string): number => SPECIES_XP[bugId] ?? 0;

/** Recompute and store a user's XP from their distinct caught species. */
async function recomputeXp(userId: string, env: Env): Promise<void> {
  const rows = await env.DB.prepare('SELECT DISTINCT bug_id FROM catches WHERE user_id = ?')
    .bind(userId)
    .all<{ bug_id: string }>();
  const xp = rows.results.reduce((sum, r) => sum + xpFor(r.bug_id), 0);
  await env.DB.prepare('UPDATE users SET xp_total = ? WHERE id = ?').bind(xp, userId).run();
}

async function invalidateLeaderboards(env: Env): Promise<void> {
  await Promise.all([env.LEADERBOARD.delete(boardKey('global')), env.LEADERBOARD.delete(boardKey('weekly'))]);
}

const BUG_ID_RE = /^[a-z0-9-]{1,64}$/;
/** One catch is identified by user + species + time, so uploading it twice is harmless. */
const catchId = (userId: string, bugId: string, at: number) => `${userId}:${bugId}:${at}`;

/** 2020-01-01: nothing older is a real catch. */
const MIN_CATCH_AT = 1_577_836_800_000;

type ValidCatch = { bugId: string; at: number; lat: number | null; lng: number | null };

/**
 * A catch from the client, or null when it's malformed: a well-formed species id, a time
 * between 2020 and a day from now (clock skew), and coordinates only as a valid pair.
 */
function parseCatch(c: unknown, now: number): ValidCatch | null {
  if (!c || typeof c !== 'object') return null;
  const { bugId, at, lat, lng } = c as Record<string, unknown>;
  if (typeof bugId !== 'string' || !BUG_ID_RE.test(bugId)) return null;
  if (typeof at !== 'number' || !(at > MIN_CATCH_AT && at <= now + 86_400_000)) return null;
  const hasLoc = typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return { bugId, at: Math.floor(at), lat: hasLoc ? lat : null, lng: hasLoc ? lng : null };
}

/** The JSON body if it is an object, else null (the caller answers 400). */
async function readJson<T extends object>(request: Request): Promise<Partial<T> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Partial<T>) : null;
  } catch {
    return null;
  }
}

// ── User row → BackendUser ────────────────────────────────────────────────────

function rowToUser(row: UserRow): BackendUser {
  const user: BackendUser = { id: row.id, displayName: row.display_name, joinedAt: row.joined_at };
  if (row.avatar_emoji) user.avatarEmoji = row.avatar_emoji;
  if (row.country) user.country = row.country;
  return user;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

const USER_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (equal-length hex digests). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Exchange `{ userId, secret }` for a JWT.
 *
 * The userId is public (it appears in leaderboard and friends responses), so it
 * proves nothing. The `secret` is a high-entropy value generated on the device and
 * never shown to anyone: the first login for an id registers its SHA-256 hash, and
 * every later login must present a secret with the same hash. An id with no stored
 * hash can't be claimed, so a login can only ever create a *new* user.
 */
async function handleAuth(request: Request, env: Env): Promise<Response> {
  // CF-Connecting-IP is set by Cloudflare and can't be spoofed by the client (X-Forwarded-For can).
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await env.AUTH_LIMITER.limit({ key: ip })).success) return json({ error: 'too many requests' }, 429);

  const body = await readJson<{ userId: unknown; secret: unknown }>(request);
  if (!body) return json({ error: 'invalid json' }, 400);
  if (typeof body.userId !== 'string' || !USER_ID_RE.test(body.userId)) {
    return json({ error: 'userId required' }, 400);
  }
  if (typeof body.secret !== 'string' || body.secret.length < 32 || body.secret.length > 256) {
    return json({ error: 'secret required' }, 400);
  }
  const userId = body.userId;
  const secretHash = await sha256Hex(body.secret);
  const now = Date.now();

  const existing = await env.DB.prepare('SELECT secret_hash FROM users WHERE id = ?')
    .bind(userId)
    .first<{ secret_hash: string | null }>();

  if (existing) {
    // Wrong secret, or a pre-secret row nobody may claim: same answer either way.
    if (!existing.secret_hash || !timingSafeEqual(existing.secret_hash, secretHash)) return errUnauthorized();
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now, userId).run();
  } else {
    // First login: register the secret. INSERT OR IGNORE keeps a concurrent first
    // login with a different secret from overwriting the winner. New users start hidden:
    // only the app's profile sync (the user's own leaderboard switch) makes them visible.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, display_name, xp_total, leaderboard_visible, joined_at, last_seen_at, secret_hash)
       VALUES (?, ?, 0, 0, ?, ?, ?)`,
    )
      .bind(userId, `user_${userId.slice(0, 6)}`, now, now, secretHash)
      .run();
    const created = await env.DB.prepare('SELECT secret_hash FROM users WHERE id = ?')
      .bind(userId)
      .first<{ secret_hash: string | null }>();
    if (!created?.secret_hash || !timingSafeEqual(created.secret_hash, secretHash)) return errUnauthorized();
  }

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

/** Every profile field ends up in other users' leaderboards and feeds, so each is bounded. */
const NAME_MAX = 32; // the app caps names at 18
const EMOJI_MAX = 16; // ZWJ emoji sequences run to ~11 UTF-16 units
const COUNTRY_MAX = 64; // a region name or 'private'

const optionalString = (v: unknown, max: number): v is string | null | undefined =>
  v == null || (typeof v === 'string' && v.length <= max);

async function handleSyncProfile(userId: string, request: Request, env: Env): Promise<Response> {
  const snap = await readJson<ProfileSnapshot>(request);
  if (
    !snap ||
    !optionalString(snap.avatarEmoji, EMOJI_MAX) ||
    !optionalString(snap.country, COUNTRY_MAX) ||
    typeof snap.leaderboardVisible !== 'boolean'
  ) {
    return json({ error: 'bad_profile' }, 400);
  }
  // A rejected name (empty, too long, offensive) keeps the old one but must not block the rest:
  // hiding has to work whatever the name.
  const name = typeof snap.displayName === 'string' ? snap.displayName.trim() : '';
  const nameOk = name.length > 0 && name.length <= NAME_MAX && !isOffensiveName(name);
  await env.DB.prepare(
    `UPDATE users
     SET display_name = COALESCE(?, display_name), avatar_emoji = ?, country = ?, leaderboard_visible = ?
     WHERE id = ?`,
  )
    .bind(nameOk ? name : null, snap.avatarEmoji ?? null, snap.country ?? null, snap.leaderboardVisible ? 1 : 0, userId)
    .run();
  // Name, visibility and country are all in the cached boards: a user who hides must drop off now, not in 5 min.
  await invalidateLeaderboards(env);
  return nameOk ? noContent() : json({ error: 'display_name_not_allowed' }, 422);
}

async function handlePublishCatch(userId: string, request: Request, env: Env): Promise<Response> {
  const input = parseCatch(await readJson<PublishCatchInput>(request), Date.now());
  if (!input) return json({ error: 'bad_catch' }, 400);
  const { at } = input;
  const id = catchId(userId, input.bugId, at);

  const ins = await env.DB.prepare('INSERT OR IGNORE INTO catches (id, user_id, bug_id, lat, lng, at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, input.bugId, input.lat, input.lng, at)
    .run();
  if (!ins.meta.changes) return noContent(); // already uploaded

  await recomputeXp(userId, env);
  await invalidateLeaderboards(env);

  // Fan out a catch event into each follower's inbox.
  const catcher = await env.DB.prepare(
    'SELECT id, display_name, avatar_emoji FROM users WHERE id = ?',
  ).bind(userId).first<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji'>>();

  if (catcher) {
    const actor: ActorRef = { userId: catcher.id, displayName: catcher.display_name, rel: 'following' };
    if (catcher.avatar_emoji) actor.avatarEmoji = catcher.avatar_emoji;

    const event: FeedEvent = { id, kind: 'catch', at, actor, bugId: input.bugId };

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

async function handleBatchCatches(userId: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ catches: unknown[] }>(request);
  const list = body?.catches;
  if (!Array.isArray(list) || list.length === 0 || list.length > 100) return json({ error: 'bad_batch' }, 400);

  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];
  for (const raw of list) {
    const c = parseCatch(raw, now);
    if (!c) return json({ error: 'bad_catch' }, 400);
    stmts.push(
      env.DB.prepare('INSERT OR IGNORE INTO catches (id, user_id, bug_id, lat, lng, at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(catchId(userId, c.bugId, c.at), userId, c.bugId, c.lat, c.lng, c.at),
    );
  }
  await env.DB.batch(stmts);
  await recomputeXp(userId, env);
  await invalidateLeaderboards(env); // no follower fan-out: these are old catches, not news
  return noContent();
}

async function handleClearLocations(userId: string, env: Env): Promise<Response> {
  await env.DB.prepare('UPDATE catches SET lat = NULL, lng = NULL WHERE user_id = ?').bind(userId).run();
  return noContent();
}

/**
 * Shared sightings for the map overlay: other players' catches that still have coordinates (only
 * people who share locations), nearest first. Species, exact spot and date only, never who: a name
 * on a trail of exact spots would show where someone lives and walks.
 */
const SIGHTINGS_LIMIT = 100;
const SIGHTINGS_MAX_AGE_MS = 365 * 24 * 3600 * 1000;
// ponytail: a ±1° box (~110 km) around the player, no antimeridian wrap; fine for Europe, widen
// or tile it if packs ever cover the Pacific.
const SIGHTINGS_BOX_DEG = 1;

async function handleNearbySightings(userId: string, url: URL, env: Env): Promise<Response> {
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!url.searchParams.has('lat') || !url.searchParams.has('lng') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'bad location' }, 400);
  }
  // A degree of longitude shrinks towards the poles: scale it so "nearest" means real distance.
  const k = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const boxLng = Math.min(180, SIGHTINGS_BOX_DEG / k);
  const rows = await env.DB.prepare(
    `SELECT bug_id, lat, lng, at FROM catches
     WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND at >= ? AND user_id != ?
     ORDER BY (lat - ?) * (lat - ?) + (lng - ?) * (lng - ?) * ? LIMIT ?`,
  )
    .bind(
      lat - SIGHTINGS_BOX_DEG, lat + SIGHTINGS_BOX_DEG, lng - boxLng, lng + boxLng,
      Date.now() - SIGHTINGS_MAX_AGE_MS, userId,
      lat, lat, lng, lng, k * k, SIGHTINGS_LIMIT,
    )
    .all<{ bug_id: string; lat: number; lng: number; at: number }>();
  return json({
    sightings: rows.results.map((r) => ({ bugId: r.bug_id, lat: r.lat, lng: r.lng, at: r.at })),
  });
}

async function handleDeleteAccount(userId: string, env: Env): Promise<Response> {
  // Feed events naming this user sit in their followers' inboxes (catches) and in the inboxes of
  // the people they followed ("followed you"): scrub both first, while we still know who they are.
  const linked = await env.DB.prepare(
    'SELECT follower_id AS id FROM follows WHERE followee_id = ? UNION SELECT followee_id FROM follows WHERE follower_id = ?',
  )
    .bind(userId, userId)
    .all<{ id: string }>();
  await Promise.allSettled(
    linked.results.map((row) =>
      env.FEED_INBOX.get(env.FEED_INBOX.idFromName(row.id)).fetch('https://inbox/purge-actor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }),
    ),
  );
  await env.FEED_INBOX.get(env.FEED_INBOX.idFromName(userId)).fetch('https://inbox/clear', { method: 'POST' });

  await env.DB.batch([
    env.DB.prepare('DELETE FROM catches WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM follows WHERE follower_id = ? OR followee_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
  await invalidateLeaderboards(env);
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
  let fetchedAt = Date.now();

  if (scope === 'global' || scope === 'weekly') {
    const board = await cachedBoard(scope, env);
    fetchedAt = board.fetchedAt;
    entries = board.entries.map((e) => (e.userId === userId ? { ...e, isSelf: true } : e));
  } else {
    // Friends scope — user + everyone they follow. Per caller, so the caller may see themselves while hidden.
    const following = await env.DB.prepare('SELECT followee_id FROM follows WHERE follower_id = ?')
      .bind(userId).all<{ followee_id: string }>();
    const ids = [userId, ...following.results.map((r) => r.followee_id)];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await env.DB.prepare(
      `SELECT id, display_name, avatar_emoji, country, xp_total, leaderboard_visible
       FROM users WHERE id IN (${placeholders})
       ORDER BY xp_total DESC`,
    ).bind(...ids).all<UserRow>();
    entries = rows.results
      .filter((r) => r.leaderboard_visible === 1 || r.id === userId)
      .map((r, i) => toEntry(r, r.xp_total, i + 1, userId));
  }

  const { items, nextCursor } = slice(entries, offset, limit);
  const selfEntry = entries.find((e) => e.isSelf);
  return json({
    scope,
    entries: items,
    selfRank: selfVisible ? (selfEntry?.rank ?? null) : null,
    totalCount: entries.length,
    fetchedAt,
    nextCursor,
  } satisfies LeaderboardPage);
}

type BoardRow = Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji' | 'country'>;

function toEntry(r: BoardRow, xp: number, rank: number, selfId?: string): LeaderboardEntry {
  const e: LeaderboardEntry = { userId: r.id, displayName: r.display_name, xp, rank, rankDelta: null };
  if (r.avatar_emoji) e.avatarEmoji = r.avatar_emoji;
  if (r.country) e.country = r.country;
  if (r.id === selfId) e.isSelf = true;
  return e;
}

// ── Shared boards (global / weekly) ───────────────────────────────────────────
// One snapshot per scope serves every caller, so it holds visible users only: a hidden
// caller must never be written into it. Refreshed by the cron, dropped on changes.

type Board = { entries: LeaderboardEntry[]; fetchedAt: number };

// New key names: the old `leaderboard:*` values had another shape and simply expire.
const boardKey = (scope: 'global' | 'weekly') => `board:${scope}`;

async function buildBoard(scope: 'global' | 'weekly', env: Env): Promise<Board> {
  if (scope === 'global') {
    const rows = await env.DB.prepare(
      `SELECT id, display_name, avatar_emoji, country, xp_total
       FROM users WHERE leaderboard_visible = 1
       ORDER BY xp_total DESC LIMIT 1000`,
    ).all<BoardRow & { xp_total: number }>();
    return { entries: rows.results.map((r, i) => toEntry(r, r.xp_total, i + 1)), fetchedAt: Date.now() };
  }
  // Weekly XP: each distinct species a user caught in the last 7 days, at its listed XP.
  const weekStart = Date.now() - 7 * 24 * 3600 * 1000;
  const [users, caught] = await Promise.all([
    env.DB.prepare('SELECT id, display_name, avatar_emoji, country FROM users WHERE leaderboard_visible = 1').all<BoardRow>(),
    env.DB.prepare('SELECT DISTINCT user_id, bug_id FROM catches WHERE at >= ?')
      .bind(weekStart)
      .all<{ user_id: string; bug_id: string }>(),
  ]);
  const weekly = new Map<string, number>();
  for (const c of caught.results) weekly.set(c.user_id, (weekly.get(c.user_id) ?? 0) + xpFor(c.bug_id));
  const ranked = users.results
    .map((u) => ({ u, xp: weekly.get(u.id) ?? 0 }))
    .sort((x, y) => y.xp - x.xp)
    .slice(0, 1000);
  return { entries: ranked.map(({ u, xp }, i) => toEntry(u, xp, i + 1)), fetchedAt: Date.now() };
}

async function storeBoard(scope: 'global' | 'weekly', env: Env): Promise<Board> {
  const board = await buildBoard(scope, env);
  await env.LEADERBOARD.put(boardKey(scope), JSON.stringify(board), { expirationTtl: 3600 });
  return board;
}

async function cachedBoard(scope: 'global' | 'weekly', env: Env): Promise<Board> {
  return (await env.LEADERBOARD.get<Board>(boardKey(scope), 'json')) ?? storeBoard(scope, env);
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
    // Suggested: visible users not already followed, ranked by popularity (follower count).
    // Hidden users are never suggested: being findable is what the leaderboard switch controls.
    // No `reason`: popularity isn't one the app can name, and a made-up one would be a lie.
    const rows = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji, u.country, u.xp_total,
              COUNT(f2.follower_id) AS follower_count
       FROM users u
       LEFT JOIN follows f2 ON f2.followee_id = u.id
       WHERE u.id != ?
         AND u.leaderboard_visible = 1
         AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = u.id)
       GROUP BY u.id
       ORDER BY follower_count DESC, u.xp_total DESC
       LIMIT 50`,
    ).bind(userId, userId).all<Pick<UserRow, 'id' | 'display_name' | 'avatar_emoji' | 'country' | 'xp_total'>>();
    nodes = rows.results.map((r) => friendNode(r, 'suggested'));
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
  // Only real users: following made-up ids would create an inbox (Durable Object) per id.
  const target = await env.DB.prepare('SELECT 1 AS ok FROM users WHERE id = ?').bind(targetId).first();
  if (!target) return json({ error: 'not found' }, 404);
  const now = Date.now();

  const ins = await env.DB.prepare(
    `INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT DO NOTHING`,
  ).bind(callerId, targetId, now).run();
  if (!ins.meta.changes) return noContent(); // already following: no second "followed you"

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
      let events: FeedEvent[] = (await this.state.storage.get<FeedEvent[]>('events')) ?? [];
      // One "followed you" per person: follow/unfollow cycling must not push real events out.
      if (event.kind === 'follow') {
        events = events.filter((e) => !(e.kind === 'follow' && e.actor.userId === event.actor.userId));
      }
      events.unshift(event);
      if (events.length > 200) events.length = 200;
      await this.state.storage.put('events', events);
      return new Response(null, { status: 204 });
    }

    if (request.method === 'POST' && url.pathname === '/clear') {
      await this.state.storage.deleteAll();
      return new Response(null, { status: 204 });
    }

    if (request.method === 'POST' && url.pathname === '/purge-actor') {
      const { userId } = (await request.json()) as { userId: string };
      const events: FeedEvent[] = (await this.state.storage.get<FeedEvent[]>('events')) ?? [];
      await this.state.storage.put('events', events.filter((e) => e.actor?.userId !== userId));
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
  if (!(await env.API_LIMITER.limit({ key: userId })).success) return json({ error: 'too many requests' }, 429);

  if (method === 'GET'  && path === '/v1/identity')   return handleIdentity(userId, env);
  if (method === 'POST' && path === '/v1/profile')    return handleSyncProfile(userId, request, env);
  if (method === 'POST' && path === '/v1/catches')    return handlePublishCatch(userId, request, env);
  if (method === 'POST' && path === '/v1/catches/batch') return handleBatchCatches(userId, request, env);
  if (method === 'DELETE' && path === '/v1/catches/locations') return handleClearLocations(userId, env);
  if (method === 'DELETE' && path === '/v1/account')  return handleDeleteAccount(userId, env);
  if (method === 'GET'  && path === '/v1/leaderboard') return handleLeaderboard(userId, url, env);
  if (method === 'GET'  && path === '/v1/friends')    return handleFriends(userId, url, env);
  if (method === 'GET'  && path === '/v1/feed')       return handleFeed(userId, url, env);
  if (method === 'GET'  && path === '/v1/sightings/nearby') return handleNearbySightings(userId, url, env);

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
    let response: Response;
    try {
      response = await routeRequest(request, env);
    } catch (err) {
      // Still a JSON answer with CORS headers, not Cloudflare's bare error page.
      console.error(err);
      response = json({ error: 'internal error' }, 500);
    }
    return applyOrigin(response, request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await Promise.all([storeBoard('global', env), storeBoard('weekly', env)]);
  },
};
