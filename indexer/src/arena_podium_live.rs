// SPDX-License-Identifier: AGPL-3.0-or-later

//! Live podium top-3 projections for `GET /v1/arena/podiums` ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)).

use alloy_primitives::{Address, U256};
use alloy_provider::ReqwestProvider;
use eyre::Result;
use sqlx::postgres::PgConnection;
use sqlx::Error as SqlxError;
use sqlx::Row;

use crate::chain_timer::{podium_at_block, PodiumRpcRow};
use crate::decoder::{DecodedEvent, DecodedLog};

/// Onchain category indices in frontend UX order (Last Buy · WarBow · Defended · Time Booster).
pub const PODIUM_UX_CATEGORY_ORDER: [u8; 4] = [0, 3, 2, 1];

pub const PODIUM_CATEGORY_LABELS: [&str; 4] = [
    "last_buy",
    "warbow",
    "defended_streak",
    "time_booster",
];

fn u256_dec(n: U256) -> String {
    n.to_string()
}

fn b256_hex(h: alloy_primitives::B256) -> String {
    format!("{:#x}", h)
}

#[derive(Debug, Clone)]
pub struct LivePodiumRow {
    pub winners: [String; 3],
    pub values: [String; 3],
}

pub fn empty_live_row() -> LivePodiumRow {
    LivePodiumRow {
        winners: std::array::from_fn(|_| {
            "0x0000000000000000000000000000000000000000".to_string()
        }),
        values: std::array::from_fn(|_| "0".to_string()),
    }
}

fn row_from_rpc(p: &PodiumRpcRow) -> LivePodiumRow {
    LivePodiumRow {
        winners: p.winners.clone(),
        values: p.values.clone(),
    }
}

pub async fn upsert_live_podium_slots_conn(
    conn: &mut PgConnection,
    category: u8,
    epoch: U256,
    block: i64,
    tx_hash: &str,
    log_index: i32,
    row: &LivePodiumRow,
) -> Result<()> {
    for slot in 0i16..3 {
        sqlx::query(
            r#"INSERT INTO idx_arena_podium_live (
                category, epoch, slot, player, score, block_number, tx_hash, log_index
            ) VALUES ($1, $2::numeric, $3, $4, $5::numeric, $6, $7, $8)
            ON CONFLICT (category, epoch, slot) DO UPDATE SET
                player = EXCLUDED.player,
                score = EXCLUDED.score,
                block_number = EXCLUDED.block_number,
                tx_hash = EXCLUDED.tx_hash,
                log_index = EXCLUDED.log_index"#,
        )
        .bind(category as i16)
        .bind(u256_dec(epoch))
        .bind(slot)
        .bind(&row.winners[slot as usize])
        .bind(&row.values[slot as usize])
        .bind(block)
        .bind(tx_hash)
        .bind(log_index)
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

pub async fn snapshot_podium_rpc_at_block(
    conn: &mut PgConnection,
    provider: &ReqwestProvider,
    arena: Address,
    d: &DecodedLog,
    category: u8,
    epoch: U256,
) -> Result<()> {
    let rpc = podium_at_block(provider, arena, d.block_number, category).await?;
    let row = row_from_rpc(&rpc);
    let block = d.block_number as i64;
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    upsert_live_podium_slots_conn(conn, category, epoch, block, &tx_h, log_i, &row).await
}

pub async fn rebuild_warbow_live_from_scores_conn(
    conn: &mut PgConnection,
    d: &DecodedLog,
    epoch: U256,
) -> Result<()> {
    let top = warbow_top3_from_scores_conn(conn, &u256_dec(epoch)).await?;
    let block = d.block_number as i64;
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    upsert_live_podium_slots_conn(conn, 3, epoch, block, &tx_h, log_i, &top).await
}

/// Latest `battle_points` per player for an epoch, sorted desc (top 3).
pub async fn warbow_top3_from_scores_conn(
    conn: &mut PgConnection,
    epoch: &str,
) -> Result<LivePodiumRow, SqlxError> {
    let rows = sqlx::query(
        r#"SELECT player, battle_points::text AS score
           FROM (
               SELECT DISTINCT ON (player) player, battle_points, block_number, log_index
               FROM idx_warbow_epoch_score
               WHERE epoch = $1::numeric
               ORDER BY player, block_number DESC, log_index DESC
           ) latest
           ORDER BY battle_points DESC, block_number DESC, log_index DESC
           LIMIT 3"#,
    )
    .bind(epoch)
    .fetch_all(&mut *conn)
    .await?;

    let mut out = empty_live_row();
    for (i, r) in rows.iter().enumerate().take(3) {
        out.winners[i] = r.get::<String, _>("player");
        out.values[i] = r.get::<String, _>("score");
    }
    Ok(out)
}

pub async fn fetch_live_podium_conn(
    conn: &mut PgConnection,
    category: u8,
    epoch: &str,
) -> Result<Option<LivePodiumRow>, SqlxError> {
    let rows = sqlx::query(
        r#"SELECT slot, player, score::text AS score
           FROM idx_arena_podium_live
           WHERE category = $1 AND epoch = $2::numeric
           ORDER BY slot ASC"#,
    )
    .bind(category as i16)
    .bind(epoch)
    .fetch_all(&mut *conn)
    .await?;

    if rows.is_empty() {
        return Ok(None);
    }

    let mut out = empty_live_row();
    for r in rows {
        let slot: i16 = r.get("slot");
        if !(0..=2).contains(&slot) {
            continue;
        }
        let i = slot as usize;
        out.winners[i] = r.get::<String, _>("player");
        out.values[i] = r.get::<String, _>("score");
    }
    Ok(Some(out))
}

pub fn live_row_has_entrant(row: &LivePodiumRow) -> bool {
    row.winners.iter().any(|w| {
        let w = w.trim().to_ascii_lowercase();
        w.len() == 42 && w != "0x0000000000000000000000000000000000000000"
    })
}

pub fn should_snapshot_live_podium(event: &DecodedEvent) -> bool {
    matches!(
        event,
        DecodedEvent::ArenaBuy { .. }
            | DecodedEvent::ArenaWarbowSteal { .. }
            | DecodedEvent::ArenaWarbowRevenge { .. }
            | DecodedEvent::ArenaWarbowFlagClaimed { .. }
            | DecodedEvent::ArenaWarbowGuard { .. }
            | DecodedEvent::ArenaWarbowEpochScore { .. }
            | DecodedEvent::ArenaPodiumEpochRolled { .. }
            | DecodedEvent::ArenaLastBuyEpochStarted { .. }
    )
}

pub async fn snapshot_live_podium_after_log(
    provider: &ReqwestProvider,
    arena: Address,
    d: &DecodedLog,
    conn: &mut PgConnection,
) -> Result<()> {
    let block = d.block_number;
    match &d.event {
        DecodedEvent::ArenaPodiumEpochRolled { category, epoch, .. } => {
            snapshot_podium_rpc_at_block(conn, provider, arena, d, *category, *epoch).await?;
            if *category == 3 {
                rebuild_warbow_live_from_scores_conn(conn, d, *epoch).await?;
            }
        }
        DecodedEvent::ArenaLastBuyEpochStarted { epoch, .. } => {
            snapshot_podium_rpc_at_block(conn, provider, arena, d, 0, *epoch).await?;
        }
        DecodedEvent::ArenaBuy { .. } => {
            let lb_ep = crate::warbow_score::last_buy_epoch_at_block(provider, arena, block).await?;
            snapshot_podium_rpc_at_block(conn, provider, arena, d, 0, lb_ep).await?;
            for cat in 1u8..=2 {
                let ep = crate::warbow_score::podium_epoch_at_block(provider, arena, block, cat).await?;
                snapshot_podium_rpc_at_block(conn, provider, arena, d, cat, ep).await?;
            }
            let wb_ep = crate::warbow_score::podium_epoch_at_block(provider, arena, block, 3).await?;
            rebuild_warbow_live_from_scores_conn(conn, d, wb_ep).await?;
        }
        DecodedEvent::ArenaWarbowSteal { .. }
        | DecodedEvent::ArenaWarbowRevenge { .. }
        | DecodedEvent::ArenaWarbowFlagClaimed { .. }
        | DecodedEvent::ArenaWarbowGuard { .. }
        | DecodedEvent::ArenaWarbowEpochScore { .. } => {
            let wb_ep = crate::warbow_score::podium_epoch_at_block(provider, arena, block, 3).await?;
            rebuild_warbow_live_from_scores_conn(conn, d, wb_ep).await?;
        }
        _ => {}
    }
    Ok(())
}
