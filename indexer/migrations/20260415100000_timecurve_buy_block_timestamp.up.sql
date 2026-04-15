-- Unix seconds from the RPC log when available (mirrors other indexed WarBow-style rows).
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS block_timestamp BIGINT;
