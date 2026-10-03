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
