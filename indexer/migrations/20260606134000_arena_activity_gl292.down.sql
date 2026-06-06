DROP INDEX IF EXISTS idx_arena_warbow_revenge_block_log;
DROP TABLE IF EXISTS idx_arena_warbow_revenge;
ALTER TABLE idx_arena_warbow_guard
    DROP COLUMN IF EXISTS block_timestamp;
