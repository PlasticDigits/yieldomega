-- Podium epoch finalize timestamps for session-summary since filters ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)).

ALTER TABLE idx_arena_podium_epoch
    ADD COLUMN IF NOT EXISTS block_timestamp TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_arena_podium_epoch_block_timestamp
    ON idx_arena_podium_epoch (block_timestamp DESC NULLS LAST);
