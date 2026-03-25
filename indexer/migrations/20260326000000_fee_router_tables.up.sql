-- FeeRouter observability (see docs/indexer/design.md, contracts/src/FeeRouter.sol).

CREATE TABLE IF NOT EXISTS idx_fee_router_sinks_updated (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    actor            VARCHAR(42) NOT NULL,
    old_sinks_json   TEXT NOT NULL,
    new_sinks_json   TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_fee_router_sinks_updated_block
    ON idx_fee_router_sinks_updated (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_fee_router_fees_distributed (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token            VARCHAR(42) NOT NULL,
    amount           NUMERIC(78, 0) NOT NULL,
    shares_json      TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_fee_router_fees_distributed_block
    ON idx_fee_router_fees_distributed (block_number DESC);

CREATE INDEX IF NOT EXISTS idx_rabbit_deposit_faction ON idx_rabbit_deposit (faction_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_withdrawal_faction ON idx_rabbit_withdrawal (faction_id);
