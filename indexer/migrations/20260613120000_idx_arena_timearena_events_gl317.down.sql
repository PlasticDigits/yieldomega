DROP INDEX IF EXISTS idx_arena_warbow_flag_claimed_player;
DROP INDEX IF EXISTS idx_arena_warbow_flag_claimed_block;
DROP TABLE IF EXISTS idx_arena_warbow_flag_claimed;

DROP INDEX IF EXISTS idx_arena_warbow_podium_finalized_epoch;
DROP INDEX IF EXISTS idx_arena_warbow_podium_finalized_block;
DROP TABLE IF EXISTS idx_arena_warbow_podium_finalized;

DROP INDEX IF EXISTS idx_arena_paused_set_block;
DROP TABLE IF EXISTS idx_arena_paused_set;

DROP INDEX IF EXISTS idx_arena_feature_unlocked_player;
DROP INDEX IF EXISTS idx_arena_feature_unlocked_block;
DROP TABLE IF EXISTS idx_arena_feature_unlocked;

DROP INDEX IF EXISTS idx_arena_level_up_player;
DROP INDEX IF EXISTS idx_arena_level_up_block;
DROP TABLE IF EXISTS idx_arena_level_up;

DROP INDEX IF EXISTS idx_arena_first_buy_cred_scheduled_buyer;
DROP INDEX IF EXISTS idx_arena_first_buy_cred_scheduled_block;
DROP TABLE IF EXISTS idx_arena_first_buy_cred_scheduled;
