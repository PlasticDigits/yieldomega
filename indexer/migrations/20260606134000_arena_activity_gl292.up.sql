ALTER TABLE idx_arena_warbow_guard
    ADD COLUMN IF NOT EXISTS block_timestamp TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS idx_arena_warbow_revenge (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    avenger VARCHAR(42) NOT NULL,
    stealer VARCHAR(42) NOT NULL,
    bp_taken NUMERIC(78, 0) NOT NULL,
    doub_spent NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_warbow_revenge_block_log
    ON idx_arena_warbow_revenge (block_number DESC, log_index DESC);
