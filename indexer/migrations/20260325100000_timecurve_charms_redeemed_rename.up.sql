-- Rename TimeCurve allocation-claim table to charms redeemed (same columns).
ALTER TABLE IF EXISTS idx_timecurve_allocation_claimed RENAME TO idx_timecurve_charms_redeemed;
ALTER INDEX IF EXISTS idx_timecurve_allocation_claimed_block RENAME TO idx_timecurve_charms_redeemed_block;
