// SPDX-License-Identifier: AGPL-3.0-or-later

//! Per-block Multicall3 batching for ingest-side warbow + live podium RPC ([#356](https://gitlab.com/PlasticDigits/yieldomega/-/issues/356)).

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use eyre::{Result, WrapErr};

use crate::arena_podium_live::{
    rebuild_warbow_live_from_scores_conn, row_from_rpc, should_snapshot_live_podium,
    upsert_live_podium_slots_conn,
};
use crate::chain_timer::{
    decode_podium_return, PodiumRpcRow, SEL_LAST_BUY_EPOCH, SEL_PODIUM, SEL_PODIUM_EPOCH,
};
use crate::decoder::{DecodedEvent, DecodedLog};
use crate::multicall::{aggregate3_at_block, MulticallBatch};
use crate::rpc_http::rpc_first_ok_instrumented;
use crate::rpc_metrics::{RpcCaller, RpcMethod, RpcMetrics};
use crate::warbow_score::{insert_warbow_epoch_score_conn, warbow_score_players, SEL_BATTLE_POINTS};

/// One log's planned RPC side-effects after batch execution.
#[derive(Debug, Clone)]
pub struct LogSideEffects {
    pub warbow: Option<WarbowSideEffect>,
    pub podium: Option<PodiumSideEffect>,
}

#[derive(Debug, Clone)]
pub struct WarbowSideEffect {
    pub players: Vec<Address>,
    pub epoch_result: usize,
    pub battle_points_results: Vec<usize>,
}

#[derive(Debug, Clone)]
pub enum PodiumSideEffect {
    Rolled {
        category: u8,
        epoch: U256,
        podium_result: usize,
    },
    LastBuyStarted {
        epoch: U256,
        podium_result: usize,
    },
    Buy {
        last_buy_epoch_result: usize,
        podium_results: [usize; 3],
        podium_epoch_results: [usize; 2],
        warbow_epoch_result: usize,
    },
    WarbowRebuild {
        warbow_epoch_result: usize,
    },
}

/// Planned Multicall3 batch for one block's ingest side-effects.
#[derive(Debug, Clone)]
pub struct BlockRpcPlan {
    pub batch: MulticallBatch,
    pub effects: Vec<LogSideEffects>,
    /// Sub-call count before dedupe (for operator logs).
    pub raw_subcall_count: usize,
}

pub fn needs_ingest_rpc(event: &DecodedEvent) -> bool {
    let players = warbow_score_players(event);
    let skip_warbow = matches!(event, DecodedEvent::ArenaWarbowEpochScore { .. });
    let needs_warbow = !players.is_empty() && !skip_warbow;
    let needs_podium = should_snapshot_live_podium(event);
    needs_warbow || needs_podium
}

fn decode_return_u256(data: &[u8]) -> Result<U256> {
    if data.len() < 32 {
        eyre::bail!("eth_call return too short: {} bytes", data.len());
    }
    Ok(U256::from_be_slice(&data[data.len() - 32..]))
}

fn b256_hex(h: alloy_primitives::B256) -> String {
    format!("{:#x}", h)
}

fn plan_warbow(batch: &mut MulticallBatch, arena: Address, event: &DecodedEvent) -> (Option<WarbowSideEffect>, usize) {
    let players = warbow_score_players(event);
    if players.is_empty() || matches!(event, DecodedEvent::ArenaWarbowEpochScore { .. }) {
        return (None, 0);
    }
    let raw = 1 + players.len();
    let epoch_result = batch.push_u8_arg(arena, SEL_PODIUM_EPOCH, 3);
    let battle_points_results = players
        .iter()
        .map(|p| batch.push_address_arg(arena, SEL_BATTLE_POINTS, *p))
        .collect();
    (
        Some(WarbowSideEffect {
            players,
            epoch_result,
            battle_points_results,
        }),
        raw,
    )
}

fn plan_podium(batch: &mut MulticallBatch, arena: Address, event: &DecodedEvent) -> (Option<PodiumSideEffect>, usize) {
    if !should_snapshot_live_podium(event) {
        return (None, 0);
    }
    match event {
        DecodedEvent::ArenaPodiumEpochRolled { category, epoch, .. } => {
            let podium_result = batch.push_u8_arg(arena, SEL_PODIUM, *category);
            (
                Some(PodiumSideEffect::Rolled {
                    category: *category,
                    epoch: *epoch,
                    podium_result,
                }),
                1,
            )
        }
        DecodedEvent::ArenaLastBuyEpochStarted { epoch, .. } => {
            let podium_result = batch.push_u8_arg(arena, SEL_PODIUM, 0);
            (
                Some(PodiumSideEffect::LastBuyStarted {
                    epoch: *epoch,
                    podium_result,
                }),
                1,
            )
        }
        DecodedEvent::ArenaBuy { .. } => {
            let last_buy_epoch_result = batch.push_selector(arena, SEL_LAST_BUY_EPOCH);
            let podium_results = [
                batch.push_u8_arg(arena, SEL_PODIUM, 0),
                batch.push_u8_arg(arena, SEL_PODIUM, 1),
                batch.push_u8_arg(arena, SEL_PODIUM, 2),
            ];
            let podium_epoch_results = [
                batch.push_u8_arg(arena, SEL_PODIUM_EPOCH, 1),
                batch.push_u8_arg(arena, SEL_PODIUM_EPOCH, 2),
            ];
            let warbow_epoch_result = batch.push_u8_arg(arena, SEL_PODIUM_EPOCH, 3);
            (
                Some(PodiumSideEffect::Buy {
                    last_buy_epoch_result,
                    podium_results,
                    podium_epoch_results,
                    warbow_epoch_result,
                }),
                7,
            )
        }
        DecodedEvent::ArenaWarbowSteal { .. }
        | DecodedEvent::ArenaWarbowRevenge { .. }
        | DecodedEvent::ArenaWarbowFlagClaimed { .. }
        | DecodedEvent::ArenaWarbowGuard { .. }
        | DecodedEvent::ArenaWarbowEpochScore { .. } => {
            let warbow_epoch_result = batch.push_u8_arg(arena, SEL_PODIUM_EPOCH, 3);
            (
                Some(PodiumSideEffect::WarbowRebuild { warbow_epoch_result }),
                1,
            )
        }
        _ => (None, 0),
    }
}

/// Plan all ingest-side `eth_call`s for arena logs in a block (deduped via [`MulticallBatch`]).
pub fn plan_block_rpc_batch(arena: Address, logs: &[DecodedLog]) -> BlockRpcPlan {
    let mut batch = MulticallBatch::new();
    let mut effects = Vec::with_capacity(logs.len());
    let mut raw_subcall_count = 0usize;

    for d in logs {
        let (warbow, wb_raw) = plan_warbow(&mut batch, arena, &d.event);
        let (podium, pd_raw) = plan_podium(&mut batch, arena, &d.event);
        raw_subcall_count += wb_raw + pd_raw;
        effects.push(LogSideEffects { warbow, podium });
    }

    BlockRpcPlan {
        batch,
        effects,
        raw_subcall_count,
    }
}

fn caller_for_subcall(call_data: &[u8]) -> RpcCaller {
    if call_data.len() >= 4 && call_data[..4] == SEL_BATTLE_POINTS {
        RpcCaller::WarbowScore
    } else {
        RpcCaller::PodiumLive
    }
}

async fn execute_sequential_batch(
    providers: &[ReqwestProvider],
    block_number: u64,
    batch: &MulticallBatch,
    metrics: &RpcMetrics,
) -> Result<Vec<Bytes>> {
    let block_id = BlockId::Number(block_number.into());
    let mut results = Vec::with_capacity(batch.len());
    for sub in batch.subcalls() {
        let caller = caller_for_subcall(sub.call_data.as_ref());
        let input = sub.call_data.clone();
        let target = sub.target;
        let raw = rpc_first_ok_instrumented(
            providers,
            Some(metrics),
            RpcMethod::EthCall,
            caller,
            |p| {
                let req = TransactionRequest::default()
                    .to(target)
                    .input(input.clone().into());
                async move { p.call(&req).block(block_id).await }
            },
        )
        .await
        .wrap_err("ingest sequential eth_call fallback")?;
        results.push(raw);
    }
    Ok(results)
}

/// Execute the planned batch via Multicall3 `aggregate3`, falling back to sequential `eth_call`s.
pub async fn execute_block_rpc_batch(
    providers: &[ReqwestProvider],
    block_number: u64,
    plan: &BlockRpcPlan,
    metrics: &RpcMetrics,
) -> Result<Vec<Bytes>> {
    if plan.batch.is_empty() {
        return Ok(Vec::new());
    }
    let block_id = BlockId::Number(block_number.into());
    match aggregate3_at_block(
        providers,
        block_id,
        &plan.batch,
        metrics,
        RpcCaller::Ingestion,
    )
    .await
    {
        Ok(results) => {
            tracing::debug!(
                block = block_number,
                subcalls = plan.batch.len(),
                deduped_from = plan.raw_subcall_count,
                "ingest: Multicall3 batch ok"
            );
            Ok(results)
        }
        Err(e) => {
            tracing::debug!(
                ?e,
                block = block_number,
                "ingest: Multicall3 batch failed; falling back to sequential eth_call"
            );
            execute_sequential_batch(providers, block_number, &plan.batch, metrics).await
        }
    }
}

async fn apply_warbow_side_effect(
    conn: &mut sqlx::postgres::PgConnection,
    d: &DecodedLog,
    effect: &WarbowSideEffect,
    results: &[Bytes],
) -> Result<()> {
    let epoch = decode_return_u256(results[effect.epoch_result].as_ref())?;
    for (i, player) in effect.players.iter().enumerate() {
        let bp = decode_return_u256(results[effect.battle_points_results[i]].as_ref())?;
        let mut row = d.clone();
        row.log_index = d
            .log_index
            .saturating_mul(10)
            .saturating_add(i as u64 + 1);
        insert_warbow_epoch_score_conn(conn, &row, epoch, *player, bp).await?;
    }
    Ok(())
}

async fn upsert_podium_from_rpc(
    conn: &mut sqlx::postgres::PgConnection,
    d: &DecodedLog,
    category: u8,
    epoch: U256,
    rpc: &PodiumRpcRow,
) -> Result<()> {
    let row = row_from_rpc(rpc);
    let block = d.block_number as i64;
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    upsert_live_podium_slots_conn(conn, category, epoch, block, &tx_h, log_i, &row).await
}

async fn apply_podium_side_effect(
    conn: &mut sqlx::postgres::PgConnection,
    d: &DecodedLog,
    effect: &PodiumSideEffect,
    results: &[Bytes],
) -> Result<()> {
    match effect {
        PodiumSideEffect::Rolled {
            category,
            epoch,
            podium_result,
        } => {
            let rpc = decode_podium_return(results[*podium_result].as_ref())?;
            upsert_podium_from_rpc(conn, d, *category, *epoch, &rpc).await?;
            if *category == 3 {
                rebuild_warbow_live_from_scores_conn(conn, d, *epoch).await?;
            }
        }
        PodiumSideEffect::LastBuyStarted {
            epoch,
            podium_result,
        } => {
            let rpc = decode_podium_return(results[*podium_result].as_ref())?;
            upsert_podium_from_rpc(conn, d, 0, *epoch, &rpc).await?;
        }
        PodiumSideEffect::Buy {
            last_buy_epoch_result,
            podium_results,
            podium_epoch_results,
            warbow_epoch_result,
        } => {
            let lb_ep = decode_return_u256(results[*last_buy_epoch_result].as_ref())?;
            let rpc0 = decode_podium_return(results[podium_results[0]].as_ref())?;
            upsert_podium_from_rpc(conn, d, 0, lb_ep, &rpc0).await?;
            for cat in 1u8..=2 {
                let ep = decode_return_u256(
                    results[podium_epoch_results[(cat - 1) as usize]].as_ref(),
                )?;
                let rpc = decode_podium_return(results[podium_results[cat as usize]].as_ref())?;
                upsert_podium_from_rpc(conn, d, cat, ep, &rpc).await?;
            }
            let wb_ep = decode_return_u256(results[*warbow_epoch_result].as_ref())?;
            rebuild_warbow_live_from_scores_conn(conn, d, wb_ep).await?;
        }
        PodiumSideEffect::WarbowRebuild {
            warbow_epoch_result,
        } => {
            let wb_ep = decode_return_u256(results[*warbow_epoch_result].as_ref())?;
            rebuild_warbow_live_from_scores_conn(conn, d, wb_ep).await?;
        }
    }
    Ok(())
}

/// Apply pre-fetched RPC results to warbow + live podium tables (no network).
pub async fn apply_log_side_effects(
    conn: &mut sqlx::postgres::PgConnection,
    d: &DecodedLog,
    effect: &LogSideEffects,
    results: &[Bytes],
) -> Result<()> {
    if let Some(ref wb) = effect.warbow {
        apply_warbow_side_effect(conn, d, wb, results).await?;
    }
    if let Some(ref pd) = effect.podium {
        apply_podium_side_effect(conn, d, pd, results).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::B256;
    use crate::decoder::DecodedEvent;

    fn sample_log(event: DecodedEvent) -> DecodedLog {
        DecodedLog {
            contract: Address::repeat_byte(0xaa),
            block_number: 42,
            block_hash: B256::repeat_byte(0x22),
            tx_hash: B256::repeat_byte(0x11),
            log_index: 7,
            block_timestamp: None,
            event,
        }
    }

    #[test]
    fn arena_buy_plans_deduped_podium_epoch_three() {
        let arena = Address::repeat_byte(0xab);
        let logs = [sample_log(DecodedEvent::ArenaBuy {
            buyer: Address::repeat_byte(0x01),
            charm_wad: U256::from(1),
            doub_paid: U256::from(2),
            new_deadline: U256::from(4),
            total_doub_raised_after: U256::ZERO,
            buy_index: U256::from(5),
            actual_seconds_added: U256::from(3),
            timer_hard_reset: false,
            paid_with_cred: false,
        })];
        let plan = plan_block_rpc_batch(arena, &logs);
        // lastBuyEpoch + podium(0..2) + podiumEpoch(1,2,3) + battlePoints = 9 raw, 8 deduped
        assert_eq!(plan.raw_subcall_count, 9);
        assert_eq!(plan.batch.len(), 8);
        assert!(plan.effects[0].warbow.is_some());
        assert!(matches!(plan.effects[0].podium, Some(PodiumSideEffect::Buy { .. })));
        let wb = plan.effects[0].warbow.as_ref().unwrap();
        let buy = match &plan.effects[0].podium {
            Some(PodiumSideEffect::Buy {
                warbow_epoch_result, ..
            }) => *warbow_epoch_result,
            _ => panic!("expected Buy"),
        };
        assert_eq!(wb.epoch_result, buy);
    }

    #[test]
    fn multi_buy_same_block_dedupes_shared_epoch_reads() {
        let arena = Address::repeat_byte(0xab);
        let buy = |n: u8| {
            sample_log(DecodedEvent::ArenaBuy {
                buyer: Address::repeat_byte(n),
                charm_wad: U256::ONE,
                doub_paid: U256::ONE,
                new_deadline: U256::ONE,
                total_doub_raised_after: U256::ZERO,
                buy_index: U256::from(n),
                actual_seconds_added: U256::ONE,
                timer_hard_reset: false,
                paid_with_cred: false,
            })
        };
        let logs = [buy(1), buy(2), buy(3)];
        let plan = plan_block_rpc_batch(arena, &logs);
        assert_eq!(plan.raw_subcall_count, 27);
        // Shared: lastBuyEpoch, podium(0..2), podiumEpoch(1,2,3) = 7 + 3×battlePoints
        assert_eq!(plan.batch.len(), 10);
    }

    #[test]
    fn warbow_steal_plans_two_battle_points_and_epoch() {
        let arena = Address::repeat_byte(0xab);
        let logs = [sample_log(DecodedEvent::ArenaWarbowSteal {
            attacker: Address::repeat_byte(0x01),
            victim: Address::repeat_byte(0x02),
            bp_taken: U256::from(10),
            doub_spent: U256::ZERO,
            limit_bypass: false,
        })];
        let plan = plan_block_rpc_batch(arena, &logs);
        assert_eq!(plan.raw_subcall_count, 4);
        assert_eq!(plan.batch.len(), 3);
        let wb = plan.effects[0].warbow.as_ref().unwrap();
        assert_eq!(wb.players.len(), 2);
        assert!(matches!(
            plan.effects[0].podium,
            Some(PodiumSideEffect::WarbowRebuild { .. })
        ));
    }

    #[test]
    fn podium_epoch_rolled_single_podium_call() {
        let arena = Address::repeat_byte(0xab);
        let logs = [sample_log(DecodedEvent::ArenaPodiumEpochRolled {
            category: 1,
            epoch: U256::from(5),
            first: Address::ZERO,
            second: Address::ZERO,
            third: Address::ZERO,
            pool_paid: U256::ZERO,
        })];
        let plan = plan_block_rpc_batch(arena, &logs);
        assert_eq!(plan.batch.len(), 1);
        assert!(plan.effects[0].warbow.is_none());
        assert!(matches!(
            plan.effects[0].podium,
            Some(PodiumSideEffect::Rolled { category: 1, .. })
        ));
    }

    #[test]
    fn last_buy_epoch_started_single_podium_zero() {
        let arena = Address::repeat_byte(0xab);
        let logs = [sample_log(DecodedEvent::ArenaLastBuyEpochStarted {
            epoch: U256::from(2),
            deadline: U256::from(100),
        })];
        let plan = plan_block_rpc_batch(arena, &logs);
        assert_eq!(plan.batch.len(), 1);
        assert!(matches!(
            plan.effects[0].podium,
            Some(PodiumSideEffect::LastBuyStarted { .. })
        ));
    }

    #[test]
    fn warbow_epoch_score_no_rpc_subcalls() {
        let arena = Address::repeat_byte(0xab);
        let logs = [sample_log(DecodedEvent::ArenaWarbowEpochScore {
            player: Address::repeat_byte(0x01),
            epoch: U256::from(1),
            battle_points: U256::from(100),
        })];
        let plan = plan_block_rpc_batch(arena, &logs);
        assert_eq!(plan.batch.len(), 1);
        assert!(plan.effects[0].warbow.is_none());
        assert!(matches!(
            plan.effects[0].podium,
            Some(PodiumSideEffect::WarbowRebuild { .. })
        ));
    }

    #[test]
    fn needs_ingest_rpc_skips_warbow_on_epoch_score_event() {
        let event = DecodedEvent::ArenaWarbowEpochScore {
            player: Address::ZERO,
            epoch: U256::ONE,
            battle_points: U256::ONE,
        };
        assert!(needs_ingest_rpc(&event));
        let plan = plan_block_rpc_batch(
            Address::ZERO,
            &[sample_log(event)],
        );
        assert!(plan.effects[0].warbow.is_none());
    }
}
