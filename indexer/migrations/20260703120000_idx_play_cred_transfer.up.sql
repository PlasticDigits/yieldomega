-- PlayCred ERC-20 Transfer mint/burn ledger for wallet CRED balance (ops mint + on-chain parity).

CREATE TABLE IF NOT EXISTS idx_play_cred_transfer (
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_play_cred_transfer_to ON idx_play_cred_transfer (to_address);
CREATE INDEX IF NOT EXISTS idx_play_cred_transfer_from ON idx_play_cred_transfer (from_address);
CREATE INDEX IF NOT EXISTS idx_play_cred_transfer_block ON idx_play_cred_transfer (block_number DESC);
