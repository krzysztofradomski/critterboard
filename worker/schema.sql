-- Critterboard D1 schema
-- Apply with: wrangler d1 execute critterboard --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id                   TEXT    PRIMARY KEY,
  display_name         TEXT    NOT NULL,
  avatar_emoji         TEXT,
  country              TEXT,
  xp_total             INTEGER NOT NULL DEFAULT 0,
  -- Hidden until the app's profile sync says otherwise (the user's leaderboard switch).
  leaderboard_visible  INTEGER NOT NULL DEFAULT 0,
  joined_at            INTEGER NOT NULL,
  last_seen_at         INTEGER NOT NULL,
  -- SHA-256 (hex) of the per-device secret that proves ownership of this id.
  -- Existing databases: ALTER TABLE users ADD COLUMN secret_hash TEXT;
  secret_hash          TEXT
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id  TEXT    NOT NULL,
  followee_id  TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS catches (
  id       TEXT    PRIMARY KEY,
  user_id  TEXT    NOT NULL,
  bug_id   TEXT    NOT NULL,
  lat      REAL,
  lng      REAL,
  at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catches_user    ON catches(user_id, at DESC);
-- Shared sightings: nearest catches with coordinates (GET /v1/sightings/nearby).
CREATE INDEX IF NOT EXISTS idx_catches_lat     ON catches(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

-- Training contributions: labelled photos players opted in to share (CC BY 4.0). The JPEG is in
-- R2 (TRAINING) at r2_key; no location is ever stored. See src/training.ts.
CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bug_id TEXT NOT NULL,
  latin TEXT NOT NULL,
  kind TEXT NOT NULL,            -- 'manual' (named by the player) | 'confirmed' (model ID accepted)
  top3 TEXT NOT NULL,            -- JSON [{ bug_id, p }]
  model_version INTEGER,
  pack_version INTEGER,
  aim TEXT NOT NULL,             -- JSON {} | { tap: [x, y] } | { reticle: [x, y, side] }, photo fractions
  credit_name TEXT NOT NULL,
  licence TEXT NOT NULL,
  at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  bytes INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS contributions_user ON contributions(user_id, created_at);
CREATE INDEX IF NOT EXISTS contributions_created ON contributions(created_at);
-- Deleted contributions (ids only), so the developer's pulled copies can be removed too.
CREATE TABLE IF NOT EXISTS deleted_contributions (
  id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS deleted_contributions_at ON deleted_contributions(deleted_at);
