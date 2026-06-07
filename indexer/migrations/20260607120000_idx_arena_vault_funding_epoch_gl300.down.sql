DROP INDEX IF EXISTS idx_arena_vault_funding_target_epoch;

DELETE FROM idx_arena_vault_funding WHERE kind = 'podium_epoch';

ALTER TABLE idx_arena_vault_funding
    DROP CONSTRAINT IF EXISTS idx_arena_vault_funding_kind_check;

ALTER TABLE idx_arena_vault_funding
    ADD CONSTRAINT idx_arena_vault_funding_kind_check
    CHECK (kind IN ('podium_active', 'podium_seed', 'admin'));

ALTER TABLE idx_arena_vault_funding
    DROP COLUMN IF EXISTS target_epoch;
