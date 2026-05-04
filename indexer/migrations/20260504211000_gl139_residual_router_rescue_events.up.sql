-- GitLab #139 — TimeCurve `PodiumResidualRecipientSet`; TimeCurveBuyRouter `EthRescued` / `Erc20Rescued`
-- (distinct ABI names/topics from `FeeRouter.ERC20Rescued`).

CREATE TABLE IF NOT EXISTS idx_timecurve_podium_residual_recipient_set (
    block_number       BIGINT NOT NULL,
    block_hash         VARCHAR(66) NOT NULL,
    tx_hash            VARCHAR(66) NOT NULL,
    log_index          INT NOT NULL,
    contract_address   VARCHAR(42) NOT NULL,
    recipient          VARCHAR(42) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_podium_residual_recipient_set_block
    ON idx_timecurve_podium_residual_recipient_set (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_buy_router_eth_rescued (
    block_number       BIGINT NOT NULL,
    block_hash         VARCHAR(66) NOT NULL,
    tx_hash            VARCHAR(66) NOT NULL,
    log_index          INT NOT NULL,
    contract_address   VARCHAR(42) NOT NULL,
    to_address         VARCHAR(42) NOT NULL,
    amount             NUMERIC NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_router_eth_rescued_block
    ON idx_timecurve_buy_router_eth_rescued (block_number DESC);

CREATE TABLE IF NOT EXISTS idx_timecurve_buy_router_erc20_rescued (
    block_number       BIGINT NOT NULL,
    block_hash         VARCHAR(66) NOT NULL,
    tx_hash            VARCHAR(66) NOT NULL,
    log_index          INT NOT NULL,
    contract_address   VARCHAR(42) NOT NULL,
    token              VARCHAR(42) NOT NULL,
    to_address         VARCHAR(42) NOT NULL,
    amount             NUMERIC NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_router_erc20_rescued_block
    ON idx_timecurve_buy_router_erc20_rescued (block_number DESC);
