-- Live D1: wrangler d1 execute critterboard --remote --file=migrations/0001_training_contributions.sql
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
