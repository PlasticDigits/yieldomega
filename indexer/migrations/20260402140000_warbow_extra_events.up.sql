-- WarBow CL8Y burn reasons + defended streak feed events (mirrors TimeCurve.sol).

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_cl8y_burned (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    block_timestamp  BIGINT,
    payer            VARCHAR(42) NOT NULL,
    reason           SMALLINT NOT NULL,
    amount_wad       NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_cl8y_burned_block
    ON idx_timecurve_warbow_cl8y_burned (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_ds_continued (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    block_timestamp  BIGINT,
    wallet           VARCHAR(42) NOT NULL,
    active_streak    NUMERIC(78, 0) NOT NULL,
    best_streak      NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_ds_continued_block
    ON idx_timecurve_warbow_ds_continued (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_ds_broken (
    block_number        BIGINT NOT NULL,
    block_hash          VARCHAR(66) NOT NULL,
    tx_hash             VARCHAR(66) NOT NULL,
    log_index           INT NOT NULL,
    contract_address    VARCHAR(42) NOT NULL,
    block_timestamp     BIGINT,
    former_holder       VARCHAR(42) NOT NULL,
    interrupter         VARCHAR(42) NOT NULL,
    broken_active_length NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_ds_broken_block
    ON idx_timecurve_warbow_ds_broken (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_ds_window_cleared (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    block_timestamp  BIGINT,
    cleared_wallet   VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_ds_window_cleared_block
    ON idx_timecurve_warbow_ds_window_cleared (block_number DESC);
