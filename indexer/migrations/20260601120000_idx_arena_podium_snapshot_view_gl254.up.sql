-- Rolled podium epochs (#254). `idx_arena_podium_snapshot` is a read alias for `idx_arena_podium_epoch`.
CREATE OR REPLACE VIEW idx_arena_podium_snapshot AS
SELECT
    block_number,
    tx_hash,
    log_index,
    category,
    epoch,
    first_place,
    second_place,
    third_place,
    pool_paid
FROM idx_arena_podium_epoch;
