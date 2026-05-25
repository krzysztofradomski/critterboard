-- Critterboard D1 schema
-- Apply with: wrangler d1 execute critterboard --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id                   TEXT    PRIMARY KEY,
  display_name         TEXT    NOT NULL,
  avatar_emoji         TEXT,
  country              TEXT,
  xp_total             INTEGER NOT NULL DEFAULT 0,
  leaderboard_visible  INTEGER NOT NULL DEFAULT 1,
  joined_at            INTEGER NOT NULL,
  last_seen_at         INTEGER NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
