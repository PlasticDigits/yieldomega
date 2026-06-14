-- TimeArena event gaps + WarBow flag claim persistence ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)).

CREATE TABLE IF NOT EXISTS idx_arena_first_buy_cred_scheduled (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    buyer VARCHAR(42) NOT NULL,
    target_epoch NUMERIC(78, 0) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_first_buy_cred_scheduled_block
    ON idx_arena_first_buy_cred_scheduled (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_first_buy_cred_scheduled_buyer
    ON idx_arena_first_buy_cred_scheduled (buyer);

CREATE TABLE IF NOT EXISTS idx_arena_level_up (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    player VARCHAR(42) NOT NULL,
    new_level NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_level_up_block
    ON idx_arena_level_up (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_level_up_player
    ON idx_arena_level_up (player);

CREATE TABLE IF NOT EXISTS idx_arena_feature_unlocked (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    player VARCHAR(42) NOT NULL,
    feature_level NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_feature_unlocked_block
    ON idx_arena_feature_unlocked (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_feature_unlocked_player
    ON idx_arena_feature_unlocked (player);

CREATE TABLE IF NOT EXISTS idx_arena_paused_set (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    paused BOOLEAN NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_paused_set_block
    ON idx_arena_paused_set (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_arena_warbow_podium_finalized (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    first_place VARCHAR(42),
    second_place VARCHAR(42),
    third_place VARCHAR(42),
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_warbow_podium_finalized_block
    ON idx_arena_warbow_podium_finalized (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_warbow_podium_finalized_epoch
    ON idx_arena_warbow_podium_finalized (epoch);

CREATE TABLE IF NOT EXISTS idx_arena_warbow_flag_claimed (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    player VARCHAR(42) NOT NULL,
    bonus_bp NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_warbow_flag_claimed_block
    ON idx_arena_warbow_flag_claimed (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_warbow_flag_claimed_player
    ON idx_arena_warbow_flag_claimed (player);
