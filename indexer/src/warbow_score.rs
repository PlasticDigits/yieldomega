// SPDX-License-Identifier: AGPL-3.0-or-later

//! Persist WarBow BP snapshots into `idx_warbow_epoch_score` ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)).

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use eyre::Result;
use sqlx::postgres::PgConnection;

use crate::chain_timer::{encode_u8_call, SEL_PODIUM_EPOCH};
use crate::decoder::{DecodedEvent, DecodedLog};

/// `battlePoints(address)`
const SEL_BATTLE_POINTS: [u8; 4] = [0xb2, 0x10, 0xd9, 0xf2];
const CAT_WARBOW: u8 = 3;

fn u256_dec(n: U256) -> String {
    n.to_string()
}

fn addr_hex(a: Address) -> String {
    format!("{:#x}", a)
}

fn b256_hex(h: alloy_primitives::B256) -> String {
    format!("{:#x}", h)
}

fn encode_address_call(sel: [u8; 4], addr: Address) -> Bytes {
    let mut data = Vec::with_capacity(4 + 32);
    data.extend_from_slice(&sel);
    let mut word = [0u8; 32];
    word[12..].copy_from_slice(addr.as_slice());
    data.extend_from_slice(&word);
    Bytes::from(data)
}

fn decode_return_u256(data: &[u8]) -> Result<U256> {
    if data.len() < 32 {
        eyre::bail!("eth_call return too short: {} bytes", data.len());
    }
    Ok(U256::from_be_slice(&data[data.len() - 32..]))
}

async fn eth_call_u256(
    provider: &ReqwestProvider,
    arena: Address,
    block: u64,
    input: Bytes,
) -> Result<U256> {
    let block_id = BlockId::Number(block.into());
    let req = TransactionRequest::default()
        .to(arena)
        .input(input.into());
    let out = provider.call(&req).block(block_id).await?;
    decode_return_u256(out.as_ref())
}

pub async fn warbow_epoch_at_block(
    provider: &ReqwestProvider,
    arena: Address,
    block: u64,
) -> Result<U256> {
    podium_epoch_at_block(provider, arena, block, CAT_WARBOW).await
}

pub async fn podium_epoch_at_block(
    provider: &ReqwestProvider,
    arena: Address,
    block: u64,
    category: u8,
) -> Result<U256> {
    eth_call_u256(
        provider,
        arena,
        block,
        encode_u8_call(SEL_PODIUM_EPOCH, category),
    )
    .await
}

pub async fn last_buy_epoch_at_block(
    provider: &ReqwestProvider,
    arena: Address,
    block: u64,
) -> Result<U256> {
    use crate::chain_timer::SEL_LAST_BUY_EPOCH;
    eth_call_u256(
        provider,
        arena,
        block,
        Bytes::copy_from_slice(&SEL_LAST_BUY_EPOCH),
    )
    .await
}

pub async fn battle_points_at_block(
    provider: &ReqwestProvider,
    arena: Address,
    block: u64,
    player: Address,
) -> Result<U256> {
    eth_call_u256(
        provider,
        arena,
        block,
        encode_address_call(SEL_BATTLE_POINTS, player),
    )
    .await
}

pub async fn insert_warbow_epoch_score_conn(
    conn: &mut PgConnection,
    d: &DecodedLog,
    epoch: U256,
    player: Address,
    battle_points: U256,
) -> Result<()> {
    let block = d.block_number as i64;
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    sqlx::query(
        r#"INSERT INTO idx_warbow_epoch_score (
            block_number, tx_hash, log_index, epoch, player, battle_points
        ) VALUES ($1, $2, $3, $4::numeric, $5, $6::numeric)
        ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
    )
    .bind(block)
    .bind(&tx_h)
    .bind(log_i)
    .bind(u256_dec(epoch))
    .bind(addr_hex(player))
    .bind(u256_dec(battle_points))
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// After a WarBow BP-affecting log, snapshot `battlePoints(player)` at the log block for each player.
pub async fn snapshot_warbow_players_after_log(
    provider: &ReqwestProvider,
    arena: Address,
    d: &DecodedLog,
    conn: &mut PgConnection,
    players: &[Address],
) -> Result<()> {
    if players.is_empty() {
        return Ok(());
    }
    let epoch = warbow_epoch_at_block(provider, arena, d.block_number).await?;
    for (i, player) in players.iter().enumerate() {
        let bp = battle_points_at_block(provider, arena, d.block_number, *player).await?;
        let mut row = d.clone();
        // Derivative rows: avoid PK clash with the source log's `log_index`.
        row.log_index = d
            .log_index
            .saturating_mul(10)
            .saturating_add(i as u64 + 1);
        insert_warbow_epoch_score_conn(conn, &row, epoch, *player, bp).await?;
    }
    Ok(())
}

/// Returns players whose WarBow BP may have changed for this event.
pub fn warbow_score_players(event: &DecodedEvent) -> Vec<Address> {
    match event {
        DecodedEvent::ArenaBuy { buyer, .. } => vec![*buyer],
        DecodedEvent::ArenaWarbowSteal { attacker, victim, .. } => vec![*attacker, *victim],
        DecodedEvent::ArenaWarbowRevenge { avenger, stealer, .. } => vec![*avenger, *stealer],
        DecodedEvent::ArenaWarbowFlagClaimed { player, .. } => vec![*player],
        DecodedEvent::ArenaWarbowEpochScore { player, .. } => vec![*player],
        _ => vec![],
    }
}

pub async fn persist_warbow_epoch_score_event(
    conn: &mut PgConnection,
    d: &DecodedLog,
    epoch: U256,
    player: Address,
    battle_points: U256,
) -> Result<()> {
    insert_warbow_epoch_score_conn(conn, d, epoch, player, battle_points).await
}
