ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS flag_planted;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS bp_flag_penalty;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS bp_ambush_bonus;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS bp_streak_break_bonus;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS bp_clutch_bonus;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS bp_timer_reset_bonus;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS bp_base_buy;

ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS activity_points_taken_from_leader NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy RENAME COLUMN battle_points_after TO buyer_activity_points_after;
ALTER TABLE idx_timecurve_buy RENAME COLUMN timer_hard_reset TO activity_attack;
