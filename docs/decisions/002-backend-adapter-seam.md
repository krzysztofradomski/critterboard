# ADR 002 — Backend adapter seam + Cloudflare Workers as target

`#adr` `#architecture` `#api` `#privacy`

> See also: [[../modules/backend-adapter]] (how it's wired), [[001-crash-reporting-opt-in]] (same opt-in posture for network features).

## Context

Three features in the existing roadmap are inherently multi-user and can't be derived from device state:

- a real **leaderboard** across the whole user base,
- a real **friend graph** (follow / follower / suggested),
- a real **social feed** showing other users' catches.

Until now these screens have been wired to static seeds in `src/data/`. We need actual server state — but the rest of the app is local-first and the Settings screen literally promises "Everything runs on your phone." We need a path to "real" that doesn't betray that promise for users who never opt in.

There is **no plan to add accounts.** The app is account-less by design; cross-device sync is explicitly out of scope.

## Decision

### 1. Introduce a single backend adapter seam

`src/backend/adapter.ts` defines one `BackendAdapter` interface with ~8 methods (`identity`, `syncProfile`, `publishCatch`, `fetchLeaderboard`, `fetchFriends`, `fetchFeed`, `follow`, `unfollow`, `ready`). All screen code goes through React hooks in `src/backend/hooks.ts`. Screens never import the adapter or the wire types from individual implementation files.

Two implementations behind the interface:

- `mockAdapter` — today's default. Synthesizes from the existing static seeds + a deterministic peer-activity ticker.
- `cloudflareAdapter` — placeholder. Throws on every call. Flipped on by changing `USE_REMOTE_BACKEND` in `src/backend/index.ts`.

This mirrors the existing AI seam (`src/ai/`) — same pattern, same instinct: one chokepoint, two-impl swap, mocks behave like the real thing so the rest of the app never special-cases.

### 2. Target Cloudflare Workers for the real backend

When the real service ships, it runs on Cloudflare:

| Concern | Component |
|---|---|
| HTTP entrypoint | A single Worker (e.g. `critterboard-api`) fronting versioned routes (`/v1/leaderboard`, `/v1/follows`, `/v1/catches`, `/v1/feed`). |
| Relational storage | **D1.** User table (`backendUserId → display_name, country, xp_total, joined_at`), `follows` edges, `catches` event log. |
| Personalized feed | **Durable Object** per user. Worker pushes feed events into the DO inbox on every `publishCatch`/`follow`; UI reads back via `fetchFeed`. Avoids global table scans on the read path. |
| Cached leaderboard | **KV.** Global + weekly snapshots recomputed every ~5 min by a Cron Trigger. Reads are eventually-consistent — fine for a leaderboard. |
| Rate limiting | CF's built-in `rate_limiting` binding keyed on `backendUserId`. Adapter surfaces 429 as `BackendError('rate-limited')`. |
| Auth | The local `backendUserId` (UUID v4) is the bearer credential on first call. Worker exchanges it for a short-lived signed JWT so subsequent calls don't re-send the raw id. |

### 3. Identity is the existing `backendUserId` slice

Added to the store as part of this change: a device-local pseudonymous id, generated on first run, persisted, rotated by `wipeAll`. The mock treats it as the caller's id. The cloudflare adapter exchanges it for a JWT.

There is no email, phone, OAuth, or recovery path. **Lose the device → lose the identity.** This is the explicit cost of the account-less posture; the docs and UI never promise otherwise.

### 4. Same opt-in posture as crash reporting

`profile.networkOn` is the master gate. The hook layer is the chokepoint — when network is off, no adapter method is ever called, so the cloudflare impl can't leak a request even if `USE_REMOTE_BACKEND` is true.

`profile.leaderboardOn` and `profile.locationShareOn` continue to do exactly what they did before — they shape what the server sees, not whether the server is called.

## Alternatives considered

| Option | Why not |
|---|---|
| **Supabase / Firebase / PocketBase** | All come with an opinionated auth model that pushes us toward accounts. The friction to keep the surface account-less would offset the BaaS savings. |
| **Hand-rolled REST on Fly.io / Render** | Viable, but Cloudflare's D1 + Durable Objects + KV map cleanly onto our three storage shapes (relational, per-user inbox, global cache) with zero VM/cluster management. |
| **GraphQL** | The 8 methods are read-heavy and ranked; the gain from field-level selection doesn't pay for the toolchain. JSON over HTTP is plenty. |
| **WebSockets / SSE for the feed** | Live feed is a nice-to-have, not a requirement. A pull-on-tab-focus model in the hooks layer is enough — and trivially compatible with Workers' request/response model. Can be added later behind the same `fetchFeed` shape. |
| **gRPC** | Native RN gRPC story is awkward in Expo, and CF Workers don't speak it without an extra hop. Not worth it for 8 methods. |

## Consequences

- **+1 layer between screens and data.** The hooks are small (~150 lines total) and the gain — one chokepoint, easy to mock, easy to gate — pays for it in the first month of touching this code.
- **New persisted slice (`backendUserId`).** Backfilled in `wireStorage.getItem` so legacy persisted profiles get a fresh id on first load without nuking anything else. Mirrors how `crashReportingOn` was added in ADR 001.
- **Old `src/data/leaderboard.ts` and `src/data/personProfiles.ts` are *only* read by the mock adapter now.** They become the source of truth for "what the world looks like when offline / pre-real-backend". Future synthetic peers go there.
- **Cloudflare bill.** Workers free tier covers the expected MAU for a long runway; D1 + KV are pennies until we have real traffic. Cost ceiling is well within hobbyist territory.
- **The cloudflare adapter is a stub today.** Until the Worker ships, flipping `USE_REMOTE_BACKEND` will throw on every screen — by design, so the flip is gated on the service actually existing.
