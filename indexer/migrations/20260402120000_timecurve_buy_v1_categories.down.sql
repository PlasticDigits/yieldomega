ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS buyer_best_defended_streak;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS buyer_active_defended_streak;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS buyer_total_effective_timer_sec;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS buyer_activity_points_after;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS activity_points_taken_from_leader;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS activity_attack;
ALTER TABLE idx_timecurve_buy DROP COLUMN IF EXISTS actual_seconds_added;
