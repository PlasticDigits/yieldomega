-- Indexer infrastructure (Arena v2 baseline — fresh DB only).

CREATE TABLE IF NOT EXISTS indexer_state (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

INSERT INTO indexer_state (key, value)
VALUES (
    'chain_pointer',
    '{"block_number": 0, "block_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"}'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS indexed_blocks (
    block_number BIGINT PRIMARY KEY,
    block_hash   VARCHAR(66) NOT NULL
);
