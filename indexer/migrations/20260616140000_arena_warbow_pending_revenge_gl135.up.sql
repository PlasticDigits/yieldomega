-- GitLab #135: victim-scoped steal / revenge lookups for pending-revenge HTTP.

CREATE INDEX IF NOT EXISTS idx_arena_warbow_steal_victim_block
    ON idx_arena_warbow_steal (victim, block_number DESC, log_index DESC);

CREATE INDEX IF NOT EXISTS idx_arena_warbow_revenge_avenger_stealer_block
    ON idx_arena_warbow_revenge (avenger, stealer, block_number DESC, log_index DESC);
