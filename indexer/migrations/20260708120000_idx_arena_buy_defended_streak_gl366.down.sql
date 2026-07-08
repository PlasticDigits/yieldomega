DROP TABLE IF EXISTS idx_arena_defended_streak_state;

ALTER TABLE idx_arena_buy
    DROP COLUMN IF EXISTS buyer_active_defended_streak,
    DROP COLUMN IF EXISTS buyer_best_defended_streak;
