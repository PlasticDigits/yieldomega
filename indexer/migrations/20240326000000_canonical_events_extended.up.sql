-- Remaining canonical RabbitTreasury Burrow* and TimeCurve events (docs/indexer/design.md).

CREATE TABLE IF NOT EXISTS idx_rabbit_epoch_opened (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    epoch_id          NUMERIC(78, 0) NOT NULL,
    start_timestamp   NUMERIC(78, 0) NOT NULL,
    end_timestamp     NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_epoch_opened_block ON idx_rabbit_epoch_opened (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_health_epoch_finalized (
    block_number               BIGINT NOT NULL,
    block_hash                 VARCHAR(66) NOT NULL,
    tx_hash                    VARCHAR(66) NOT NULL,
    log_index                  INT NOT NULL,
    contract_address           VARCHAR(42) NOT NULL,
    epoch_id                   NUMERIC(78, 0) NOT NULL,
    finalized_at               NUMERIC(78, 0) NOT NULL,
    reserve_ratio_wad          NUMERIC(78, 0) NOT NULL,
    doub_total_supply          NUMERIC(78, 0) NOT NULL,
    repricing_factor_wad       NUMERIC(78, 0) NOT NULL,
    backing_per_doubloon_wad   NUMERIC(78, 0) NOT NULL,
    internal_state_e_wad       NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_health_epoch_finalized_block
    ON idx_rabbit_health_epoch_finalized (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_epoch_reserve_snapshot (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    epoch_id          NUMERIC(78, 0) NOT NULL,
    reserve_asset     VARCHAR(42) NOT NULL,
    balance           NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_epoch_reserve_snapshot_block
    ON idx_rabbit_epoch_reserve_snapshot (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_reserve_balance_updated (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    reserve_asset     VARCHAR(42) NOT NULL,
    balance_after     NUMERIC(78, 0) NOT NULL,
    delta             VARCHAR(80) NOT NULL,
    reason_code       SMALLINT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_reserve_balance_updated_block
    ON idx_rabbit_reserve_balance_updated (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_fee_accrued (
    block_number         BIGINT NOT NULL,
    block_hash           VARCHAR(66) NOT NULL,
    tx_hash              VARCHAR(66) NOT NULL,
    log_index            INT NOT NULL,
    contract_address     VARCHAR(42) NOT NULL,
    asset                VARCHAR(42) NOT NULL,
    amount               NUMERIC(78, 0) NOT NULL,
    cumulative_in_asset  NUMERIC(78, 0) NOT NULL,
    epoch_id             NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_fee_accrued_block ON idx_rabbit_fee_accrued (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_repricing_applied (
    block_number           BIGINT NOT NULL,
    block_hash             VARCHAR(66) NOT NULL,
    tx_hash                VARCHAR(66) NOT NULL,
    log_index              INT NOT NULL,
    contract_address       VARCHAR(42) NOT NULL,
    epoch_id               NUMERIC(78, 0) NOT NULL,
    repricing_factor_wad   NUMERIC(78, 0) NOT NULL,
    prior_internal_price_wad NUMERIC(78, 0) NOT NULL,
    new_internal_price_wad NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_repricing_applied_block
    ON idx_rabbit_repricing_applied (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_params_updated (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    actor            VARCHAR(42) NOT NULL,
    param_name       TEXT NOT NULL,
    old_value        NUMERIC(78, 0) NOT NULL,
    new_value        NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_params_updated_block ON idx_rabbit_params_updated (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_allocation_claimed (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    buyer            VARCHAR(42) NOT NULL,
    token_amount     NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_allocation_claimed_block
    ON idx_timecurve_allocation_claimed (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_prizes_distributed (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_prizes_distributed_block
    ON idx_timecurve_prizes_distributed (block_number DESC);
