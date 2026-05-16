-- Post-revenge Battle Points snapshots (matches `WarBowSteal` victim/attacker BP columns; GitLab parity with onchain ladder).

ALTER TABLE idx_timecurve_warbow_revenge
    ADD COLUMN IF NOT EXISTS stealer_bp_after NUMERIC(78, 0);
ALTER TABLE idx_timecurve_warbow_revenge
    ADD COLUMN IF NOT EXISTS avenger_bp_after NUMERIC(78, 0);
