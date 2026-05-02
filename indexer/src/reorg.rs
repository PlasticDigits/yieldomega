// SPDX-License-Identifier: AGPL-3.0-or-later

//! Chain pointer persistence and reorg rollback.

use alloy_primitives::B256;
use alloy_provider::Provider;
use eyre::{bail, Result};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

/// Maximum ancestor walk during reorg before treating as catastrophic.
pub const MAX_REORG_DEPTH: u64 = 128;

/// The indexer's canonical tip.
#[derive(Debug, Clone, Copy)]
pub struct ChainPointer {
    pub block_number: u64,
    pub block_hash: B256,
}

#[derive(Serialize, Deserialize)]
struct PointerJson {
    block_number: u64,
    block_hash: String,
}

pub(crate) fn pointer_to_json(p: &ChainPointer) -> Result<serde_json::Value> {
    let pj = PointerJson {
        block_number: p.block_number,
        block_hash: format!("{:#x}", p.block_hash),
    };
    Ok(serde_json::to_value(pj)?)
}

pub(crate) fn parse_b256_hex(s: &str) -> Result<B256> {
    s.parse::<B256>()
        .map_err(|e| eyre::eyre!("invalid block_hash in chain_pointer: {e}"))
}

/// Load pointer from `indexer_state` or default before any indexed blocks.
pub async fn load_chain_pointer(pool: &PgPool) -> Result<ChainPointer> {
    let row = sqlx::query("SELECT value FROM indexer_state WHERE key = 'chain_pointer'")
        .fetch_optional(pool)
        .await?;

    let Some(row) = row else {
        return Ok(ChainPointer {
            block_number: 0,
            block_hash: B256::ZERO,
        });
    };

    let v: serde_json::Value = row.try_get("value")?;
    let pj: PointerJson = serde_json::from_value(v)?;
    Ok(ChainPointer {
        block_number: pj.block_number,
        block_hash: parse_b256_hex(&pj.block_hash)?,
    })
}

/// Persist pointer after successfully processing a block.
pub async fn save_chain_pointer(pool: &PgPool, p: &ChainPointer) -> Result<()> {
    let json = pointer_to_json(p)?;
    sqlx::query(
        "INSERT INTO indexer_state (key, value) VALUES ('chain_pointer', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(json)
    .execute(pool)
    .await?;
    Ok(())
}

/// Record a canonical block hash for reorg walk-back.
pub async fn upsert_indexed_block(pool: &PgPool, number: u64, hash: B256) -> Result<()> {
    let n = number as i64;
    let h = format!("{:#x}", hash);
    sqlx::query(
        "INSERT INTO indexed_blocks (block_number, block_hash) VALUES ($1, $2)
         ON CONFLICT (block_number) DO UPDATE SET block_hash = EXCLUDED.block_hash",
    )
    .bind(n)
    .bind(&h)
    .execute(pool)
    .await?;
    Ok(())
}

/// Stored hash for `block_number`, if any.
pub async fn get_stored_block_hash(pool: &PgPool, block_number: u64) -> Result<Option<B256>> {
    let n = block_number as i64;
    let row = sqlx::query("SELECT block_hash FROM indexed_blocks WHERE block_number = $1")
        .bind(n)
        .fetch_optional(pool)
        .await?;
    if let Some(r) = row {
        let s: String = r.try_get("block_hash")?;
        return Ok(Some(parse_b256_hex(&s)?));
    }
    Ok(None)
}

/// Delete all indexed data strictly after `ancestor_block` and set pointer to ancestor.
pub async fn rollback_after(pool: &PgPool, ancestor: ChainPointer) -> Result<()> {
    let cut = ancestor.block_number as i64;
    let mut tx = pool.begin().await?;

    for table in [
        "idx_doub_vesting_claimed",
        "idx_doub_vesting_claims_enabled",
        "idx_doub_vesting_started",
        "idx_fee_router_fees_distributed",
        "idx_fee_router_sinks_updated",
        "idx_fee_sink_withdrawn",
        "idx_nft_minted",
        "idx_nft_series_created",
        "idx_podium_pool_paid",
        "idx_podium_pool_prize_pusher_set",
        "idx_rabbit_burrow_reserve_buckets",
        "idx_rabbit_deposit",
        "idx_rabbit_epoch_opened",
        "idx_rabbit_epoch_reserve_snapshot",
        "idx_rabbit_fee_accrued",
        "idx_rabbit_health_epoch_finalized",
        "idx_rabbit_params_updated",
        "idx_rabbit_protocol_revenue_split",
        "idx_rabbit_repricing_applied",
        "idx_rabbit_reserve_balance_updated",
        "idx_rabbit_withdrawal",
        "idx_rabbit_withdrawal_fee_accrued",
        "idx_referral_code_registered",
        "idx_timecurve_buy",
        "idx_timecurve_buy_fee_routing_enabled",
        "idx_timecurve_buy_router_cl8y_surplus",
        "idx_timecurve_buy_router_kumbaya",
        "idx_timecurve_buy_router_set",
        "idx_timecurve_charm_redemption_enabled",
        "idx_timecurve_charms_redeemed",
        "idx_timecurve_prizes_distributed",
        "idx_timecurve_referral_applied",
        "idx_timecurve_reserve_podium_payouts_enabled",
        "idx_timecurve_sale_ended",
        "idx_timecurve_sale_started",
        "idx_timecurve_warbow_cl8y_burned",
        "idx_timecurve_warbow_ds_broken",
        "idx_timecurve_warbow_ds_continued",
        "idx_timecurve_warbow_ds_window_cleared",
        "idx_timecurve_warbow_flag_claimed",
        "idx_timecurve_warbow_flag_penalized",
        "idx_timecurve_warbow_guard",
        "idx_timecurve_warbow_revenge",
        "idx_timecurve_warbow_steal",
    ] {
        let q = format!("DELETE FROM {table} WHERE block_number > $1");
        sqlx::query(&q).bind(cut).execute(&mut *tx).await?;
    }

    sqlx::query("DELETE FROM indexed_blocks WHERE block_number > $1")
        .bind(cut)
        .execute(&mut *tx)
        .await?;

    let json = pointer_to_json(&ancestor)?;
    sqlx::query(
        "INSERT INTO indexer_state (key, value) VALUES ('chain_pointer', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(json)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Walk backward from `from_height` until RPC hash matches `indexed_blocks`, or limit exceeded.
pub async fn find_common_ancestor(
    pool: &PgPool,
    provider: &alloy_provider::ReqwestProvider,
    from_height: u64,
) -> Result<u64> {
    use alloy_rpc_types::BlockTransactionsKind;

    let mut n = from_height;
    for _ in 0..MAX_REORG_DEPTH {
        let block = provider
            .get_block_by_number(n.into(), BlockTransactionsKind::Hashes)
            .await?
            .ok_or_else(|| eyre::eyre!("missing block {n} from RPC during reorg"))?;

        let rpc_b256: B256 = block.header.hash;

        if let Some(stored) = get_stored_block_hash(pool, n).await? {
            if stored == rpc_b256 {
                return Ok(n);
            }
        }

        if n == 0 {
            bail!("reorg walk reached genesis without common ancestor");
        }
        n -= 1; // mismatch or missing local row — walk back
    }

    bail!("reorg deeper than MAX_REORG_DEPTH ({MAX_REORG_DEPTH}); manual re-index required");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_b256_hex_accepts_prefixed_hash() {
        let h = B256::from([0xab; 32]);
        let parsed = parse_b256_hex(&format!("{h:#x}")).unwrap();
        assert_eq!(parsed, h);
    }

    #[test]
    fn parse_b256_hex_rejects_garbage() {
        assert!(parse_b256_hex("not-a-hash").is_err());
    }

    #[test]
    fn pointer_json_roundtrip() {
        let p = ChainPointer {
            block_number: 42,
            block_hash: B256::from([7u8; 32]),
        };
        let v = pointer_to_json(&p).unwrap();
        assert_eq!(v["block_number"], 42);
        let s = v["block_hash"].as_str().unwrap();
        let back = parse_b256_hex(s).unwrap();
        assert_eq!(back, p.block_hash);
    }
}
