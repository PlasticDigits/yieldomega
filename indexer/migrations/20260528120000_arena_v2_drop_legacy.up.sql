-- Arena v2 (#241–#244): drop retired Rabbit Treasury / FeeRouter index tables.
-- Irreversible for production data; restore from backup if needed.

DROP INDEX IF EXISTS idx_rabbit_deposit_faction;
DROP INDEX IF EXISTS idx_rabbit_withdrawal_faction;

DROP TABLE IF EXISTS idx_rabbit_withdrawal_fee_accrued;
DROP TABLE IF EXISTS idx_rabbit_protocol_revenue_split;
DROP TABLE IF EXISTS idx_rabbit_burrow_reserve_buckets;
DROP TABLE IF EXISTS idx_rabbit_params_updated;
DROP TABLE IF EXISTS idx_rabbit_repricing_applied;
DROP TABLE IF EXISTS idx_rabbit_fee_accrued;
DROP TABLE IF EXISTS idx_rabbit_withdrawal;
DROP TABLE IF EXISTS idx_rabbit_deposit;
DROP TABLE IF EXISTS idx_rabbit_reserve_balance_updated;
DROP TABLE IF EXISTS idx_rabbit_epoch_reserve_snapshot;
DROP TABLE IF EXISTS idx_rabbit_health_epoch_finalized;
DROP TABLE IF EXISTS idx_rabbit_epoch_opened;

DROP TABLE IF EXISTS idx_fee_router_erc20_rescued;
DROP TABLE IF EXISTS idx_fee_router_distributable_token_updated;
DROP TABLE IF EXISTS idx_fee_router_fees_distributed;
DROP TABLE IF EXISTS idx_fee_router_sinks_updated;
