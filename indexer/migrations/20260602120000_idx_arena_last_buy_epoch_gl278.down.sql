DROP INDEX IF EXISTS idx_arena_buy_buyer_last_buy_epoch;
ALTER TABLE idx_arena_buy DROP COLUMN IF EXISTS last_buy_epoch;
DROP TABLE IF EXISTS idx_arena_last_buy_epoch_started;
