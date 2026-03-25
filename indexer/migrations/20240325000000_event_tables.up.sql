-- Canonical event projections (see docs/indexer/design.md).

CREATE TABLE IF NOT EXISTS indexed_blocks (
    block_number BIGINT PRIMARY KEY,
    block_hash   VARCHAR(66) NOT NULL
);

CREATE TABLE IF NOT EXISTS idx_timecurve_sale_started (
    block_number           BIGINT NOT NULL,
    block_hash             VARCHAR(66) NOT NULL,
    tx_hash                VARCHAR(66) NOT NULL,
    log_index              INT NOT NULL,
    contract_address       VARCHAR(42) NOT NULL,
    start_timestamp        NUMERIC(78, 0) NOT NULL,
    initial_deadline       NUMERIC(78, 0) NOT NULL,
    total_tokens_for_sale  NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_sale_started_block ON idx_timecurve_sale_started (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_buy (
    block_number         BIGINT NOT NULL,
    block_hash           VARCHAR(66) NOT NULL,
    tx_hash              VARCHAR(66) NOT NULL,
    log_index            INT NOT NULL,
    contract_address     VARCHAR(42) NOT NULL,
    buyer                VARCHAR(42) NOT NULL,
    amount               NUMERIC(78, 0) NOT NULL,
    current_min_buy      NUMERIC(78, 0) NOT NULL,
    new_deadline         NUMERIC(78, 0) NOT NULL,
    total_raised_after   NUMERIC(78, 0) NOT NULL,
    buy_index            NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_buy_block ON idx_timecurve_buy (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_buyer ON idx_timecurve_buy (buyer);

CREATE TABLE IF NOT EXISTS idx_timecurve_sale_ended (
    block_number    BIGINT NOT NULL,
    block_hash      VARCHAR(66) NOT NULL,
    tx_hash         VARCHAR(66) NOT NULL,
    log_index       INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    end_timestamp   NUMERIC(78, 0) NOT NULL,
    total_raised    NUMERIC(78, 0) NOT NULL,
    total_buys      NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_sale_ended_block ON idx_timecurve_sale_ended (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_rabbit_deposit (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    user_address      VARCHAR(42) NOT NULL,
    reserve_asset     VARCHAR(42) NOT NULL,
    amount            NUMERIC(78, 0) NOT NULL,
    doub_out          NUMERIC(78, 0) NOT NULL,
    epoch_id          NUMERIC(78, 0) NOT NULL,
    faction_id        NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_deposit_block ON idx_rabbit_deposit (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_rabbit_deposit_user ON idx_rabbit_deposit (user_address);

CREATE TABLE IF NOT EXISTS idx_rabbit_withdrawal (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    user_address      VARCHAR(42) NOT NULL,
    reserve_asset     VARCHAR(42) NOT NULL,
    amount            NUMERIC(78, 0) NOT NULL,
    doub_in           NUMERIC(78, 0) NOT NULL,
    epoch_id          NUMERIC(78, 0) NOT NULL,
    faction_id        NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_rabbit_withdrawal_block ON idx_rabbit_withdrawal (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_rabbit_withdrawal_user ON idx_rabbit_withdrawal (user_address);

CREATE TABLE IF NOT EXISTS idx_nft_series_created (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    series_id        NUMERIC(78, 0) NOT NULL,
    max_supply       NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_nft_series_created_block ON idx_nft_series_created (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_nft_minted (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_id         NUMERIC(78, 0) NOT NULL,
    series_id        NUMERIC(78, 0) NOT NULL,
    to_address       VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_nft_minted_block ON idx_nft_minted (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_nft_minted_to ON idx_nft_minted (to_address);
