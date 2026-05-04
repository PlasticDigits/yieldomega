-- GitLab #135: per-(victim, stealer) revenge windows emitted as `WarBowRevengeWindowOpened`.

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_revenge_window (
    block_number          BIGINT NOT NULL,
    block_hash            VARCHAR(66) NOT NULL,
    tx_hash               VARCHAR(66) NOT NULL,
    log_index             INT NOT NULL,
    contract_address      VARCHAR(42) NOT NULL,
    block_timestamp       BIGINT,
    victim                VARCHAR(42) NOT NULL,
    stealer               VARCHAR(42) NOT NULL,
    expiry_exclusive      NUMERIC(78, 0) NOT NULL,
    steal_seq             NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_revenge_window_block
    ON idx_timecurve_warbow_revenge_window (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_revenge_window_victim
    ON idx_timecurve_warbow_revenge_window (victim);
