-- TimeArenaBuyRouter BuyViaKumbaya ingest (GitLab #319 / #67).

CREATE TABLE IF NOT EXISTS idx_arena_buy_router_kumbaya (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    buyer VARCHAR(42) NOT NULL,
    charm_wad NUMERIC(78, 0) NOT NULL,
    gross_doub NUMERIC(78, 0) NOT NULL,
    pay_kind SMALLINT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_buy_router_kumbaya_buyer
    ON idx_arena_buy_router_kumbaya (buyer);
CREATE INDEX IF NOT EXISTS idx_arena_buy_router_kumbaya_block
    ON idx_arena_buy_router_kumbaya (block_number DESC);
