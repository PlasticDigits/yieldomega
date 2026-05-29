CREATE TABLE IF NOT EXISTS idx_arena_vault_funding (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('podium_active', 'podium_seed', 'admin')),
    podium_id SMALLINT,
    amount_doub_wad NUMERIC NOT NULL,
    pool_address TEXT,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_vault_funding_tx_hash
    ON idx_arena_vault_funding (tx_hash);
CREATE INDEX IF NOT EXISTS idx_arena_vault_funding_block_number
    ON idx_arena_vault_funding (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_vault_funding_kind_podium
    ON idx_arena_vault_funding (kind, podium_id);
