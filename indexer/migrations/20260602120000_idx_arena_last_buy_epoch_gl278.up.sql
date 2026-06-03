-- Last Buy epoch persistence ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)).

CREATE TABLE IF NOT EXISTS idx_arena_last_buy_epoch_started (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    deadline NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_last_buy_epoch_started_epoch
    ON idx_arena_last_buy_epoch_started (epoch);
CREATE INDEX IF NOT EXISTS idx_arena_last_buy_epoch_started_block
    ON idx_arena_last_buy_epoch_started (block_number DESC);

ALTER TABLE idx_arena_buy
    ADD COLUMN IF NOT EXISTS last_buy_epoch BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_arena_buy_buyer_last_buy_epoch
    ON idx_arena_buy (buyer, last_buy_epoch);

-- Deployed indexers with existing rows must reindex from deploy block for correct epoch assignment.
