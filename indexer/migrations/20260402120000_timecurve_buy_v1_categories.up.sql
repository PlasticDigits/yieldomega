-- TimeCurve Buy event v3: timer clip, activity attack, defended streak snapshots (see contracts/src/TimeCurve.sol).
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS actual_seconds_added NUMERIC(78, 0);
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS activity_attack BOOLEAN;
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS activity_points_taken_from_leader NUMERIC(78, 0);
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS buyer_activity_points_after NUMERIC(78, 0);
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS buyer_total_effective_timer_sec NUMERIC(78, 0);
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS buyer_active_defended_streak NUMERIC(78, 0);
ALTER TABLE idx_timecurve_buy ADD COLUMN IF NOT EXISTS buyer_best_defended_streak NUMERIC(78, 0);
