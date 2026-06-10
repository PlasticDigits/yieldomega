DROP INDEX IF EXISTS idx_arena_last_buy_epoch_started_anchor_ts;

ALTER TABLE idx_arena_last_buy_epoch_started
    DROP COLUMN IF EXISTS anchor_charm_price_wad,
    DROP COLUMN IF EXISTS doub_usd_wad,
    DROP COLUMN IF EXISTS anchor_timestamp_sec;
