-- WarBow ladder: Buy log semantics + Battle Point bonus columns.
ALTER TABLE idx_timecurve_buy RENAME COLUMN activity_attack TO timer_hard_reset;
ALTER TABLE idx_timecurve_buy RENAME COLUMN buyer_activity_points_after TO battle_points_after;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS activity_points_taken_from_leader;

ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS bp_base_buy NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS bp_timer_reset_bonus NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS bp_clutch_bonus NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS bp_streak_break_bonus NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS bp_ambush_bonus NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS bp_flag_penalty NUMERIC(78, 0) NOT NULL DEFAULT 0;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS flag_planted BOOLEAN NOT NULL DEFAULT false;
