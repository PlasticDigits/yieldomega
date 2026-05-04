-- PodiumPool `PodiumResidualForwarded` (GitLab #116) — orphan podium slice → protocol sink.

CREATE TABLE IF NOT EXISTS idx_podium_pool_residual_forwarded (
    block_number        BIGINT NOT NULL,
    block_hash          VARCHAR(66) NOT NULL,
    tx_hash             VARCHAR(66) NOT NULL,
    log_index           INT NOT NULL,
    contract_address    VARCHAR(42) NOT NULL,
    token_address       VARCHAR(42) NOT NULL,
    recipient_address   VARCHAR(42) NOT NULL,
    amount              NUMERIC(78, 0) NOT NULL,
    category            SMALLINT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_podium_pool_residual_forwarded_block
    ON idx_podium_pool_residual_forwarded (block_number DESC);
