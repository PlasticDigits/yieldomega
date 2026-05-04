-- GitLab #133 — TimeCurve PrizesSettledEmptyPodiumPool (empty PodiumPool at distributePrizes)
CREATE TABLE IF NOT EXISTS idx_timecurve_prizes_settled_empty_podium_pool (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    podium_pool      VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_prizes_settled_empty_podium_pool_block
    ON idx_timecurve_prizes_settled_empty_podium_pool (block_number DESC);
