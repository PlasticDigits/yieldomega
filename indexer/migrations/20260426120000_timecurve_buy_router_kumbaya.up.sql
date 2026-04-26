-- TimeCurveBuyRouter `BuyViaKumbaya` sidecar (same-tx correlation with `TimeCurve` `Buy` — GitLab #67).
CREATE TABLE IF NOT EXISTS idx_timecurve_buy_router_kumbaya (
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    contract_address TEXT NOT NULL,
    buyer TEXT NOT NULL,
    charm_wad NUMERIC(78, 0) NOT NULL,
    gross_cl8y NUMERIC(78, 0) NOT NULL,
    pay_kind SMALLINT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_tcb_kumbaya_lookup
    ON idx_timecurve_buy_router_kumbaya (tx_hash, buyer, charm_wad);
