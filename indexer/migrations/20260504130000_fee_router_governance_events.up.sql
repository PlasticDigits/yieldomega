-- FeeRouter `DistributableTokenUpdated` / `ERC20Rescued` (GitLab #122, audit L-04).

CREATE TABLE IF NOT EXISTS idx_fee_router_distributable_token_updated (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token            VARCHAR(42) NOT NULL,
    allowed          BOOLEAN NOT NULL,
    actor            VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_fee_router_distributable_token_updated_block
    ON idx_fee_router_distributable_token_updated (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_fee_router_erc20_rescued (
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

CREATE INDEX IF NOT EXISTS idx_fee_router_erc20_rescued_block
    ON idx_fee_router_erc20_rescued (block_number DESC);
