-- Per-buy defended streak snapshots + ingest replay holder state (GitLab #366).

ALTER TABLE idx_arena_buy
    ADD COLUMN IF NOT EXISTS buyer_active_defended_streak NUMERIC(78, 0),
    ADD COLUMN IF NOT EXISTS buyer_best_defended_streak NUMERIC(78, 0);

CREATE TABLE IF NOT EXISTS idx_arena_defended_streak_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    holder_address VARCHAR(42),
    holder_active NUMERIC(78, 0) NOT NULL DEFAULT 0,
    backfill_complete BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO idx_arena_defended_streak_state (id, holder_address, holder_active, backfill_complete)
VALUES (1, NULL, 0, FALSE)
ON CONFLICT (id) DO NOTHING;
