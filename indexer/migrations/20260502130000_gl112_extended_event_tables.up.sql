-- GitLab #112: decode + persist emitted contract logs previously classified as indexer gaps.

CREATE TABLE IF NOT EXISTS idx_timecurve_buy_fee_routing_enabled (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    enabled          BOOLEAN NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_fee_routing_enabled_block
    ON idx_timecurve_buy_fee_routing_enabled (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_charm_redemption_enabled (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    enabled          BOOLEAN NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_charm_redemption_enabled_block
    ON idx_timecurve_charm_redemption_enabled (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_reserve_podium_payouts_enabled (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    enabled          BOOLEAN NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_reserve_podium_payouts_enabled_block
    ON idx_timecurve_reserve_podium_payouts_enabled (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_buy_router_set (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    router_address   VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_router_set_block
    ON idx_timecurve_buy_router_set (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_buy_router_cl8y_surplus (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    amount           NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_router_cl8y_surplus_block
    ON idx_timecurve_buy_router_cl8y_surplus (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_burrow_reserve_buckets (
    block_number               BIGINT NOT NULL,
    block_hash                 VARCHAR(66) NOT NULL,
    tx_hash                    VARCHAR(66) NOT NULL,
    log_index                  INT NOT NULL,
    contract_address           VARCHAR(42) NOT NULL,
    epoch_id                   NUMERIC(78, 0) NOT NULL,
    redeemable_backing         NUMERIC(78, 0) NOT NULL,
    protocol_owned_backing     NUMERIC(78, 0) NOT NULL,
    total_backing              NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_rabbit_burrow_reserve_buckets_block
    ON idx_rabbit_burrow_reserve_buckets (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_protocol_revenue_split (
    block_number           BIGINT NOT NULL,
    block_hash             VARCHAR(66) NOT NULL,
    tx_hash                VARCHAR(66) NOT NULL,
    log_index              INT NOT NULL,
    contract_address       VARCHAR(42) NOT NULL,
    epoch_id               NUMERIC(78, 0) NOT NULL,
    gross_amount           NUMERIC(78, 0) NOT NULL,
    to_protocol_bucket     NUMERIC(78, 0) NOT NULL,
    burned_amount          NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_rabbit_protocol_revenue_split_block
    ON idx_rabbit_protocol_revenue_split (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_withdrawal_fee_accrued (
    block_number                 BIGINT NOT NULL,
    block_hash                   VARCHAR(66) NOT NULL,
    tx_hash                      VARCHAR(66) NOT NULL,
    log_index                    INT NOT NULL,
    contract_address             VARCHAR(42) NOT NULL,
    asset                        VARCHAR(42) NOT NULL,
    fee_amount                   NUMERIC(78, 0) NOT NULL,
    cumulative_withdraw_fees    NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_rabbit_withdrawal_fee_accrued_block
    ON idx_rabbit_withdrawal_fee_accrued (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_podium_pool_prize_pusher_set (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    pusher           VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_podium_pool_prize_pusher_set_block
    ON idx_podium_pool_prize_pusher_set (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_doub_vesting_started (
    block_number               BIGINT NOT NULL,
    block_hash                 VARCHAR(66) NOT NULL,
    tx_hash                    VARCHAR(66) NOT NULL,
    log_index                  INT NOT NULL,
    contract_address           VARCHAR(42) NOT NULL,
    start_timestamp            NUMERIC(78, 0) NOT NULL,
    duration_sec               NUMERIC(78, 0) NOT NULL,
    total_allocated            NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_doub_vesting_started_block
    ON idx_doub_vesting_started (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_doub_vesting_claimed (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    beneficiary      VARCHAR(42) NOT NULL,
    amount           NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_doub_vesting_claimed_block
    ON idx_doub_vesting_claimed (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_doub_vesting_claims_enabled (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    enabled          BOOLEAN NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_doub_vesting_claims_enabled_block
    ON idx_doub_vesting_claims_enabled (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_fee_sink_withdrawn (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token            VARCHAR(42) NOT NULL,
    recipient        VARCHAR(42) NOT NULL,
    amount           NUMERIC(78, 0) NOT NULL,
    actor            VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_fee_sink_withdrawn_block
    ON idx_fee_sink_withdrawn (block_number DESC);
