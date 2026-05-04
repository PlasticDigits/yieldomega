-- DoubPresaleVesting `RescueERC20` — owner recovery (GitLab #137).
CREATE TABLE IF NOT EXISTS idx_doub_vesting_rescue_erc20 (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token            VARCHAR(42) NOT NULL,
    recipient        VARCHAR(42) NOT NULL,
    amount           NUMERIC(78, 0) NOT NULL,
    kind             SMALLINT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_doub_vesting_rescue_erc20_block
    ON idx_doub_vesting_rescue_erc20 (block_number DESC);
