-- PodiumTimerArmed event persistence ([#346](https://gitlab.com/PlasticDigits/yieldomega/-/issues/346)).

CREATE TABLE IF NOT EXISTS idx_arena_podium_timer_armed (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    category SMALLINT NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_podium_timer_armed_block
    ON idx_arena_podium_timer_armed (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_podium_timer_armed_category_epoch
    ON idx_arena_podium_timer_armed (category, epoch);
