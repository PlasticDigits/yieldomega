-- Live podium top-3 projections per (category, epoch) ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)).

CREATE TABLE IF NOT EXISTS idx_arena_podium_live (
    category SMALLINT NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    slot SMALLINT NOT NULL CHECK (slot >= 0 AND slot < 3),
    player VARCHAR(42) NOT NULL,
    score NUMERIC(78, 0) NOT NULL,
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    PRIMARY KEY (category, epoch, slot)
);

CREATE INDEX IF NOT EXISTS idx_arena_podium_live_cat_epoch
    ON idx_arena_podium_live (category, epoch);
