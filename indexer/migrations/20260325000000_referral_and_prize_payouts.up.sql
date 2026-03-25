-- ReferralRegistry + TimeCurve ReferralApplied + PrizeVault PrizePaid (indexer read models).

CREATE TABLE IF NOT EXISTS idx_referral_code_registered (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    owner_address    VARCHAR(42) NOT NULL,
    code_hash        VARCHAR(66) NOT NULL,
    normalized_code TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_referral_code_registered_block
    ON idx_referral_code_registered (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_referral_applied (
    block_number        BIGINT NOT NULL,
    block_hash          VARCHAR(66) NOT NULL,
    tx_hash             VARCHAR(66) NOT NULL,
    log_index           INT NOT NULL,
    contract_address    VARCHAR(42) NOT NULL,
    buyer               VARCHAR(42) NOT NULL,
    referrer            VARCHAR(42) NOT NULL,
    code_hash           VARCHAR(66) NOT NULL,
    referrer_amount     NUMERIC(78, 0) NOT NULL,
    referee_amount      NUMERIC(78, 0) NOT NULL,
    amount_to_fee_router NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_referral_applied_block
    ON idx_timecurve_referral_applied (block_number DESC);

CREATE INDEX IF NOT EXISTS idx_timecurve_referral_applied_referrer
    ON idx_timecurve_referral_applied (referrer);

CREATE TABLE IF NOT EXISTS idx_prize_vault_prize_paid (
    block_number     BIGINT NOT NULL,
    block_hash       VARCHAR(66) NOT NULL,
    tx_hash          VARCHAR(66) NOT NULL,
    log_index        INT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    winner           VARCHAR(42) NOT NULL,
    token            VARCHAR(42) NOT NULL,
    amount           NUMERIC(78, 0) NOT NULL,
    category         SMALLINT NOT NULL,
    placement        SMALLINT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_prize_vault_prize_paid_block
    ON idx_prize_vault_prize_paid (block_number DESC);
