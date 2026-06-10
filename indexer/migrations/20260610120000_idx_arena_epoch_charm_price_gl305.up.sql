-- Last Buy epoch DOUB/CHARM anchor metadata ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)).

ALTER TABLE idx_arena_last_buy_epoch_started
    ADD COLUMN IF NOT EXISTS anchor_charm_price_wad NUMERIC(78, 0),
    ADD COLUMN IF NOT EXISTS doub_usd_wad NUMERIC(78, 0),
    ADD COLUMN IF NOT EXISTS anchor_timestamp_sec NUMERIC(78, 0);

CREATE INDEX IF NOT EXISTS idx_arena_last_buy_epoch_started_anchor_ts
    ON idx_arena_last_buy_epoch_started (anchor_timestamp_sec DESC NULLS LAST);
