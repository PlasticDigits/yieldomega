DROP INDEX IF EXISTS idx_arena_podium_epoch_block_timestamp;

ALTER TABLE idx_arena_podium_epoch
    DROP COLUMN IF EXISTS block_timestamp;
