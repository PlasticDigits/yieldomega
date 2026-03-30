-- PodiumPool contract emits PodiumPaid; table rename for clarity (see contracts/src/sinks/PodiumPool.sol).

ALTER TABLE IF EXISTS idx_prize_vault_prize_paid RENAME TO idx_podium_pool_paid;
ALTER INDEX IF EXISTS idx_prize_vault_prize_paid_block RENAME TO idx_podium_pool_paid_block;
