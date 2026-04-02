-- WarBow PvP actions (reconstructable from chain; block_timestamp when RPC provides it on logs).

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_steal (
    block_number                  BIGINT NOT NULL,
    block_hash                    VARCHAR(66) NOT NULL,
    tx_hash                       VARCHAR(66) NOT NULL,
    log_index                     INT NOT NULL,
    contract_address              VARCHAR(42) NOT NULL,
    block_timestamp               BIGINT,
    attacker                      VARCHAR(42) NOT NULL,
    victim                        VARCHAR(42) NOT NULL,
    amount_bp                     NUMERIC(78, 0) NOT NULL,
    burn_paid_wad                 NUMERIC(78, 0) NOT NULL,
    bypassed_victim_daily_limit   BOOLEAN NOT NULL,
    victim_bp_after               NUMERIC(78, 0) NOT NULL,
    attacker_bp_after             NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_steal_block
    ON idx_timecurve_warbow_steal (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_steal_victim
    ON idx_timecurve_warbow_steal (victim);
CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_steal_attacker
    ON idx_timecurve_warbow_steal (attacker);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_revenge (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    block_timestamp   BIGINT,
    avenger           VARCHAR(42) NOT NULL,
    stealer           VARCHAR(42) NOT NULL,
    amount_bp         NUMERIC(78, 0) NOT NULL,
    burn_paid_wad     NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_revenge_block
    ON idx_timecurve_warbow_revenge (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_guard (
    block_number      BIGINT NOT NULL,
    block_hash        VARCHAR(66) NOT NULL,
    tx_hash           VARCHAR(66) NOT NULL,
    log_index         INT NOT NULL,
    contract_address  VARCHAR(42) NOT NULL,
    block_timestamp   BIGINT,
    player            VARCHAR(42) NOT NULL,
    guard_until_ts    NUMERIC(78, 0) NOT NULL,
    burn_paid_wad     NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_guard_block
    ON idx_timecurve_warbow_guard (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_guard_player
    ON idx_timecurve_warbow_guard (player);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_flag_claimed (
    block_number         BIGINT NOT NULL,
    block_hash           VARCHAR(66) NOT NULL,
    tx_hash              VARCHAR(66) NOT NULL,
    log_index            INT NOT NULL,
    contract_address     VARCHAR(42) NOT NULL,
    block_timestamp      BIGINT,
    player               VARCHAR(42) NOT NULL,
    bonus_bp             NUMERIC(78, 0) NOT NULL,
    battle_points_after  NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_flag_claimed_block
    ON idx_timecurve_warbow_flag_claimed (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_warbow_flag_penalized (
    block_number          BIGINT NOT NULL,
    block_hash            VARCHAR(66) NOT NULL,
    tx_hash               VARCHAR(66) NOT NULL,
    log_index             INT NOT NULL,
    contract_address      VARCHAR(42) NOT NULL,
    block_timestamp       BIGINT,
    former_holder         VARCHAR(42) NOT NULL,
    penalty_bp            NUMERIC(78, 0) NOT NULL,
    triggering_buyer      VARCHAR(42) NOT NULL,
    battle_points_after   NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_timecurve_warbow_flag_penalized_block
    ON idx_timecurve_warbow_flag_penalized (block_number DESC);
