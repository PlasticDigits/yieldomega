ALTER TABLE IF EXISTS idx_podium_pool_paid RENAME TO idx_prize_vault_prize_paid;
ALTER INDEX IF EXISTS idx_podium_pool_paid_block RENAME TO idx_prize_vault_prize_paid_block;
