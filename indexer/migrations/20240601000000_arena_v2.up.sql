-- Arena v2 event projections (#254, #260). Fresh databases only.

CREATE TABLE IF NOT EXISTS idx_arena_buy (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    buyer VARCHAR(42) NOT NULL,
    charm_wad NUMERIC(78, 0) NOT NULL,
    doub_paid NUMERIC(78, 0) NOT NULL,
    new_deadline NUMERIC(78, 0) NOT NULL,
    total_doub_raised_after NUMERIC(78, 0) NOT NULL,
    buy_index NUMERIC(78, 0) NOT NULL,
    actual_seconds_added NUMERIC(78, 0) NOT NULL,
    timer_hard_reset BOOLEAN NOT NULL,
    paid_with_cred BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_buy_buyer ON idx_arena_buy (buyer);
CREATE INDEX IF NOT EXISTS idx_arena_buy_block ON idx_arena_buy (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_arena_buy_block_timestamp ON idx_arena_buy (block_timestamp);

CREATE TABLE IF NOT EXISTS idx_arena_started (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    start_timestamp NUMERIC(78, 0) NOT NULL,
    initial_deadline NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_arena_podium_epoch (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    category SMALLINT NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    first_place VARCHAR(42),
    second_place VARCHAR(42),
    third_place VARCHAR(42),
    pool_paid NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_play_cred_claim (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    claimer VARCHAR(42) NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_play_cred_claim_claimer ON idx_play_cred_claim (claimer);

CREATE TABLE IF NOT EXISTS idx_player_xp (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    player VARCHAR(42) NOT NULL,
    xp_gained NUMERIC(78, 0) NOT NULL,
    new_level NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_arena_referral_cred (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    buyer VARCHAR(42) NOT NULL,
    referrer VARCHAR(42) NOT NULL,
    code_hash VARCHAR(66) NOT NULL,
    referrer_cred NUMERIC(78, 0) NOT NULL,
    buyer_cred NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_arena_referral_applied (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    buyer VARCHAR(42) NOT NULL,
    referrer VARCHAR(42) NOT NULL,
    code_hash VARCHAR(66) NOT NULL,
    referrer_amount NUMERIC(78, 0) NOT NULL,
    referee_amount NUMERIC(78, 0) NOT NULL,
    doub_paid NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_arena_referral_applied_referrer ON idx_arena_referral_applied (referrer);
CREATE INDEX IF NOT EXISTS idx_arena_referral_applied_buyer ON idx_arena_referral_applied (buyer);

CREATE TABLE IF NOT EXISTS idx_arena_warbow_steal (
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    attacker VARCHAR(42) NOT NULL,
    victim VARCHAR(42) NOT NULL,
    bp_taken NUMERIC(78, 0) NOT NULL,
    doub_spent NUMERIC(78, 0) NOT NULL,
    limit_bypass BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_arena_warbow_guard (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    player VARCHAR(42) NOT NULL,
    doub_spent NUMERIC(78, 0) NOT NULL,
    guard_until NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_warbow_epoch_score (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    epoch NUMERIC(78, 0) NOT NULL,
    player VARCHAR(42) NOT NULL,
    battle_points NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS idx_referral_code_registered (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    code_hash VARCHAR(66) NOT NULL,
    normalized_code TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_referral_code_registered_block
    ON idx_referral_code_registered (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_referral_code_registered_owner_address
    ON idx_referral_code_registered (owner_address);
