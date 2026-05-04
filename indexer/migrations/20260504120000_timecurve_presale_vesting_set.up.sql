-- TimeCurve `DoubPresaleVestingSet` — presale CHARM weight wiring (beneficiary boost).

CREATE TABLE IF NOT EXISTS idx_timecurve_presale_vesting_set (
    block_number       BIGINT NOT NULL,
    block_hash         VARCHAR(66) NOT NULL,
    tx_hash            VARCHAR(66) NOT NULL,
    log_index          INT NOT NULL,
    contract_address   VARCHAR(42) NOT NULL,
    vesting_address    VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_presale_vesting_set_block
    ON idx_timecurve_presale_vesting_set (block_number DESC);
