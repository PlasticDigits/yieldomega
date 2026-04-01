-- TimeCurve Buy event v2: charm quantity + linear price snapshot (see contracts/src/TimeCurve.sol).
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS charm_wad NUMERIC(78, 0);
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS price_per_charm_wad NUMERIC(78, 0);
