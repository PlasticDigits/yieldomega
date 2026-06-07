-- GitLab #300 — PodiumEpochFunded buy routing (100% podiums · 70/20/10 epoch tranches).
ALTER TABLE idx_arena_vault_funding
    ADD COLUMN IF NOT EXISTS target_epoch NUMERIC;

ALTER TABLE idx_arena_vault_funding
    DROP CONSTRAINT IF EXISTS idx_arena_vault_funding_kind_check;

ALTER TABLE idx_arena_vault_funding
    ADD CONSTRAINT idx_arena_vault_funding_kind_check
    CHECK (kind IN ('podium_active', 'podium_seed', 'podium_epoch', 'admin'));

CREATE INDEX IF NOT EXISTS idx_arena_vault_funding_target_epoch
    ON idx_arena_vault_funding (podium_id, target_epoch)
    WHERE kind = 'podium_epoch';
