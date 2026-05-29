CREATE TABLE IF NOT EXISTS idx_arena_podium_pool_top_up (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    donor_address VARCHAR(42) NOT NULL,
    amount_doub_wad NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_podium_pool_top_up_donor
    ON idx_arena_podium_pool_top_up (donor_address);
CREATE INDEX IF NOT EXISTS idx_arena_podium_pool_top_up_block_timestamp
    ON idx_arena_podium_pool_top_up (block_timestamp DESC NULLS LAST);
