-- One-shot indexer repair after TimeArena migrateLastBuyEpochToPodium (MegaETH mainnet 2026-07-04).
--
-- On-chain: lastBuyEpoch aligned 13 → 0 (podiumEpoch[0]=0); drift CHARM/CRED consolidated into epoch 0.
-- Indexer still had MAX(idx_arena_last_buy_epoch_started)=13 and idx_arena_buy.last_buy_epoch split 1..13.
--
-- Pre-flight (read-only):
--   SELECT COALESCE(MAX(epoch), 0) FROM idx_arena_last_buy_epoch_started;
--   SELECT last_buy_epoch, COUNT(*) FROM idx_arena_buy GROUP BY 1 ORDER BY 1;
--
-- Run against production indexer Postgres (operator shell):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/fix-last-buy-epoch-drift-mainnet.sql
--
-- Post-flight:
--   SELECT COALESCE(MAX(epoch), 0) FROM idx_arena_last_buy_epoch_started;  -- expect 0
--   SELECT last_buy_epoch, COUNT(*) FROM idx_arena_buy GROUP BY 1 ORDER BY 1;  -- expect single row epoch 0
--   curl -s "$INDEXER/v1/arena/wallet/0xYOUR/wstats" | jq '.last_buy_epoch, .epoch_charm_wad'

BEGIN;

-- Spurious hard-reset epoch boundaries (no matching podium roll).
DELETE FROM idx_arena_last_buy_epoch_started
WHERE epoch > 0;

-- Fold drift-tagged buys into active epoch 0 (matches on-chain consolidation).
UPDATE idx_arena_buy
SET last_buy_epoch = 0
WHERE last_buy_epoch > 0;

-- Audit row for governance alignment tx (optional; documents head without affecting MAX).
INSERT INTO idx_arena_last_buy_epoch_started (
    block_number,
    block_timestamp,
    tx_hash,
    log_index,
    epoch,
    deadline
) VALUES (
    20370808,
    to_timestamp(1783167819),
    '0x75b885888ce062bb824ca851d572736d433210ad544e918b8ddf8ad1676f4162',
    80,
    0,
    0
)
ON CONFLICT (tx_hash, log_index) DO NOTHING;

COMMIT;
