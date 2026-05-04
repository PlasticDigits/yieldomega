-- TimeCurve unredeemed launched-token sweep observability (GitLab #128).

CREATE TABLE IF NOT EXISTS idx_timecurve_unredeemed_launched_token_recipient_set (
    block_number       BIGINT NOT NULL,
    block_hash         VARCHAR(66) NOT NULL,
    tx_hash            VARCHAR(66) NOT NULL,
    log_index          INT NOT NULL,
    contract_address   VARCHAR(42) NOT NULL,
    recipient          VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_unredeemed_launched_token_recipient_set_block
    ON idx_timecurve_unredeemed_launched_token_recipient_set (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_unredeemed_launched_token_swept (
    block_number       BIGINT NOT NULL,
    block_hash         VARCHAR(66) NOT NULL,
    tx_hash            VARCHAR(66) NOT NULL,
    log_index          INT NOT NULL,
    contract_address   VARCHAR(42) NOT NULL,
    recipient          VARCHAR(42) NOT NULL,
    amount             NUMERIC NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_unredeemed_launched_token_swept_block
    ON idx_timecurve_unredeemed_launched_token_swept (block_number DESC);
