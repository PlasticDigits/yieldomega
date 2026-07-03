// SPDX-License-Identifier: AGPL-3.0-or-later

//! Chain pointer persistence and reorg rollback.

use alloy_primitives::B256;
use alloy_provider::Provider;
use eyre::{bail, Result, WrapErr};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgConnection;
use sqlx::{PgPool, Row};

pub const MAX_REORG_DEPTH: u64 = 128;

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

pub async fn save_chain_pointer_conn(conn: &mut PgConnection, p: &ChainPointer) -> Result<()> {
    let json = pointer_to_json(p)?;
    sqlx::query(
        "INSERT INTO indexer_state (key, value) VALUES ('chain_pointer', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(json)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn save_chain_pointer(pool: &PgPool, p: &ChainPointer) -> Result<()> {
    let mut conn = pool.acquire().await?;
    save_chain_pointer_conn(&mut conn, p).await
}

pub async fn upsert_indexed_block_conn(
    conn: &mut PgConnection,
    number: u64,
    hash: B256,
) -> Result<()> {
    let n = number as i64;
    let h = format!("{:#x}", hash);
    sqlx::query(
        "INSERT INTO indexed_blocks (block_number, block_hash) VALUES ($1, $2)
         ON CONFLICT (block_number) DO UPDATE SET block_hash = EXCLUDED.block_hash",
    )
    .bind(n)
    .bind(&h)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn upsert_indexed_block(pool: &PgPool, number: u64, hash: B256) -> Result<()> {
    let mut conn = pool.acquire().await?;
    upsert_indexed_block_conn(&mut conn, number, hash).await
}

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

/// Arena v2 index tables cleared on reorg rollback (and integration test reset).
pub const ARENA_INDEX_TABLES: &[&str] = &[
    "idx_referral_code_registered",
    "idx_arena_podium_pool_top_up",
    "idx_arena_vault_funding",
    "idx_arena_buy_router_kumbaya",
    "idx_arena_buy",
    "idx_arena_last_buy_epoch_started",
    "idx_arena_started",
    "idx_arena_podium_epoch",
    "idx_arena_podium_timer_armed",
    "idx_play_cred_claim",
    "idx_play_cred_transfer",
    "idx_player_xp",
    "idx_arena_referral_cred",
    "idx_arena_referral_applied",
    "idx_arena_warbow_steal",
    "idx_arena_warbow_guard",
    "idx_arena_warbow_revenge",
    "idx_warbow_epoch_score",
    "idx_arena_podium_live",
    "idx_arena_first_buy_cred_scheduled",
    "idx_arena_level_up",
    "idx_arena_feature_unlocked",
    "idx_arena_paused_set",
    "idx_arena_warbow_podium_finalized",
    "idx_arena_warbow_flag_claimed",
];

pub async fn rollback_after(pool: &PgPool, ancestor: ChainPointer) -> Result<()> {
    let cut = ancestor.block_number as i64;
    let mut tx = pool.begin().await?;

    for table in ARENA_INDEX_TABLES {
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

pub async fn find_common_ancestor(
    pool: &PgPool,
    providers: &[alloy_provider::ReqwestProvider],
    from_height: u64,
    rpc_sticky_idx: &mut usize,
    rpc_metrics: &crate::rpc_metrics::RpcMetrics,
) -> Result<u64> {
    use crate::rpc_http::rpc_first_some_sticky_instrumented;
    use crate::rpc_metrics::{RpcCaller, RpcMethod};
    use alloy_rpc_types::BlockTransactionsKind;

    let mut n = from_height;
    for _ in 0..MAX_REORG_DEPTH {
        let block = rpc_first_some_sticky_instrumented(
            providers,
            rpc_sticky_idx,
            Some(rpc_metrics),
            RpcMethod::GetBlockByNumber,
            RpcCaller::Reorg,
            |p| p.get_block_by_number(n.into(), BlockTransactionsKind::Hashes),
        )
        .await
        .wrap_err("reorg walk RPC")?
        .ok_or_else(|| eyre::eyre!("missing block {n} from RPC during reorg"))?;

        let rpc_b256: B256 = block.header.hash;

        if let Some(stored) = get_stored_block_hash(pool, n).await? {
            if stored == rpc_b256 {
                return Ok(n);
            }
        } else if n == 0 {
            return Ok(0);
        }
        if n == 0 {
            break;
        }
        n -= 1;
    }
    bail!("reorg depth exceeded {MAX_REORG_DEPTH} blocks");
}
