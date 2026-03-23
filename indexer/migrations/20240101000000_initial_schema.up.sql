-- Initial schema placeholder.
--
-- Real tables will be added once contract ABIs are finalised and event
-- structures are known.  Until then this migration creates only the
-- infrastructure tables the indexer needs to track its own state.

CREATE TABLE IF NOT EXISTS indexer_state (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Seed the chain pointer with a sentinel row.
INSERT INTO indexer_state (key, value)
VALUES ('chain_pointer', '{"block_number": 0, "block_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"}')
ON CONFLICT (key) DO NOTHING;

-- =========================================================================
-- Event tables — STUBS (uncomment / replace when ABIs land)
-- =========================================================================
--
-- CREATE TABLE timecurve_sales ( ... );
-- CREATE TABLE timecurve_buys  ( ... );
-- CREATE TABLE timecurve_prizes ( ... );
-- CREATE TABLE rabbit_deposits_withdrawals ( ... );
-- CREATE TABLE rabbit_health_epochs ( ... );
-- CREATE TABLE leprechauns ( ... );
-- CREATE TABLE factions ( ... );
