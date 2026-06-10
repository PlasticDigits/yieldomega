// SPDX-License-Identifier: AGPL-3.0-or-later

//! JSON-RPC polling ingestion (`eth_getBlockByNumber` + `eth_getLogs`).

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use alloy_primitives::{Address, B256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockTransactionsKind, Filter};
use eyre::Result;
use sqlx::PgPool;

use crate::config::Config;
use crate::decoder::{decode_rpc_log, DecodedEvent};
use crate::last_buy_epoch_head::LastBuyEpochHead;
use crate::persist::persist_decoded_log_conn;
use crate::arena_podium_live;
use crate::warbow_score;
use crate::reorg::{
    find_common_ancestor, load_chain_pointer, rollback_after, save_chain_pointer_conn,
    upsert_indexed_block_conn, ChainPointer,
};
use crate::rpc_http::{
    build_reqwest_providers, error_chain_has_transport_rpc, error_chain_transport_http_status,
    parse_http_rpc_urls, rpc_first_ok_instrumented, rpc_first_ok_sticky_instrumented,
    rpc_first_some_sticky_instrumented, transport_err_http_status,
};
use crate::rpc_metrics::{RpcCaller, RpcMethod, RpcMetrics};
use crate::rpc_poll_health::RpcPollHealth;

/// Best-effort `eth_blockNumber` across fallback RPCs — only for stalled-ingestion diagnostics.
async fn rpc_tip_block_number_for_logs(
    providers: &[ReqwestProvider],
    metrics: &RpcMetrics,
) -> Option<u64> {
    match rpc_first_ok_instrumented(
        providers,
        Some(metrics),
        RpcMethod::BlockNumber,
        RpcCaller::Ingestion,
        |p| p.get_block_number(),
    )
    .await
    {
        Ok(n) => Some(n),
        Err(e) => {
            tracing::debug!(
                ?e,
                "ingestion: eth_blockNumber failed during stall diagnosis"
            );
            None
        }
    }
}

/// Shared atomics for [`GET /v1/status`](crate::api::router) liveness
/// ([GitLab #168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)).
#[derive(Clone)]
pub struct IngestionProgress {
    /// `true` while the block-ingestion task is in its **active** RPC+DB loop (not API-only idle).
    pub ingestion_alive: Arc<AtomicBool>,
    /// Wall-clock millis when a block was last committed; **0** if none yet.
    pub last_indexed_at_ms: Arc<AtomicU64>,
}

impl IngestionProgress {
    fn mark_indexed_now(&self) {
        let ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.last_indexed_at_ms.store(ms, Ordering::Release);
    }
}

pub(crate) fn next_block_to_process(pointer: &ChainPointer, effective_start: u64) -> u64 {
    if pointer.block_hash == B256::ZERO && pointer.block_number == 0 {
        effective_start
    } else {
        pointer.block_number + 1
    }
}

/// Bootstrap chain pointer to `(effective_start - 1, rpc_hash)` when DB is still at genesis sentinel.
async fn bootstrap_pointer(
    pool: &PgPool,
    providers: &[ReqwestProvider],
    pointer: &mut ChainPointer,
    effective_start: u64,
    rpc_sticky_idx: &mut usize,
    metrics: &RpcMetrics,
) -> Result<()> {
    if effective_start == 0 {
        return Ok(());
    }
    if pointer.block_hash != B256::ZERO || pointer.block_number != 0 {
        return Ok(());
    }

    let parent = effective_start.saturating_sub(1);
    let block = rpc_first_some_sticky_instrumented(
        providers,
        rpc_sticky_idx,
        Some(metrics),
        RpcMethod::GetBlockByNumber,
        RpcCaller::Ingestion,
        |p| p.get_block_by_number(parent.into(), BlockTransactionsKind::Hashes),
    )
    .await?
    .ok_or_else(|| eyre::eyre!("bootstrap: missing block {parent}"))?;

    let hash: B256 = block.header.hash;
    *pointer = ChainPointer {
        block_number: parent,
        block_hash: hash,
    };
    let mut tx = pool.begin().await?;
    upsert_indexed_block_conn(&mut tx, parent, hash).await?;
    save_chain_pointer_conn(&mut tx, pointer).await?;
    tx.commit().await?;
    tracing::info!(
        block = parent,
        %hash,
        "bootstrapped chain pointer before effective_start"
    );
    Ok(())
}

/// Start the ingestion loop. Returns on fatal error (caller may retry with backoff).
pub async fn run(
    pool: &PgPool,
    config: &Config,
    progress: Option<&IngestionProgress>,
    rpc_metrics: &RpcMetrics,
) -> Result<()> {
    if !config.ingestion_enabled {
        if let Some(p) = progress {
            p.ingestion_alive.store(false, Ordering::Release);
        }
        tracing::info!("INGESTION_ENABLED=false — block ingestion idle");
        loop {
            tokio::time::sleep(Duration::from_secs(3600)).await;
        }
    }

    let addrs = config
        .address_registry
        .as_ref()
        .map(|r| r.index_addresses())
        .unwrap_or_default();

    if addrs.is_empty() {
        if let Some(p) = progress {
            p.ingestion_alive.store(false, Ordering::Release);
        }
        tracing::warn!("no contract addresses in ADDRESS_REGISTRY — idle (API only)");
        loop {
            tokio::time::sleep(Duration::from_secs(3600)).await;
        }
    }

    let parsed = parse_http_rpc_urls(&config.rpc_urls)?;
    let providers = build_reqwest_providers(&parsed, config.rpc_request_timeout)?;

    let time_arena: Option<Address> = config
        .address_registry
        .as_ref()
        .and_then(|r| r.contracts.time_arena.parse().ok())
        .filter(|a| *a != Address::ZERO);

    let mut rpc_health = RpcPollHealth::new();

    let mut pointer = load_chain_pointer(pool).await?;
    let effective = config.effective_start_block();
    let mut rpc_sticky_idx = 0usize;
    bootstrap_pointer(
        pool,
        &providers,
        &mut pointer,
        effective,
        &mut rpc_sticky_idx,
        rpc_metrics,
    )
    .await?;

    if let Some(p) = progress {
        p.ingestion_alive.store(true, Ordering::Release);
    }

    tracing::info!(
        addresses = addrs.len(),
        effective_start = effective,
        tip = pointer.block_number,
        rpc_endpoints = providers.len(),
        "ingestion started"
    );

    let outcome: Result<()> = async {
        // INFO cadence while `eth_getBlockByNumber(next)` returns null (ahead-of-tip or RPC mismatch).
        let mut last_null_block_diag_at: Option<Instant> = None;
        // INFO cadence while indexing normally — avoids silent long runs at default `info` filter.
        let mut last_progress_info_at = Instant::now();

        loop {
            let next = next_block_to_process(&pointer, effective);

            let block = match rpc_first_some_sticky_instrumented(
                &providers,
                &mut rpc_sticky_idx,
                Some(rpc_metrics),
                RpcMethod::GetBlockByNumber,
                RpcCaller::Ingestion,
                |p| p.get_block_by_number(next.into(), BlockTransactionsKind::Hashes),
            )
            .await
            {
                Ok(Some(b)) => b,
                Ok(None) => {
                    rpc_health.report_success();
                    let sleep_for = rpc_health.backoff_sleep();
                    let now = Instant::now();
                    let due = last_null_block_diag_at
                        .is_none_or(|t| now.duration_since(t) >= Duration::from_secs(15));
                    if due {
                        let rpc_tip = rpc_tip_block_number_for_logs(&providers, rpc_metrics).await;
                        let tip_vs_next = rpc_tip.map(|tip| tip as i128 - next as i128);
                        tracing::info!(
                            next_block = next,
                            chain_pointer_tip = pointer.block_number,
                            rpc_eth_block_number = rpc_tip,
                            rpc_tip_minus_next = tip_vs_next,
                            sleep_ms = sleep_for.as_millis(),
                            rpc_debounced_failure_streak = rpc_health.failure_streak(),
                            "ingestion: eth_getBlockByNumber returned null from every RPC_URL entry for this height (reorder fallbacks or use a full/archive endpoint; primary may omit older blocks)"
                        );
                        last_null_block_diag_at = Some(now);
                    }
                    tokio::time::sleep(sleep_for).await;
                    continue;
                }
                Err(e) => {
                    if transport_err_http_status(&e) == Some(429) {
                        rpc_health.report_rate_limited();
                    } else {
                        rpc_health.report_failure_debounced();
                    }
                    tracing::warn!(
                        next_block = next,
                        rpc_debounced_failure_streak = rpc_health.failure_streak(),
                        ?e,
                        "ingestion: eth_getBlockByNumber errors or null from every RPC_URL entry for this height"
                    );
                    tokio::time::sleep(rpc_health.backoff_sleep()).await;
                    continue;
                }
            };

            let parent: B256 = block.header.inner.parent_hash;
            if pointer.block_hash != B256::ZERO && parent != pointer.block_hash {
                tracing::warn!(
                    next,
                    expected_parent = %pointer.block_hash,
                    actual_parent = %parent,
                    rpc_sticky_idx,
                    "reorg detected (parent hash mismatch — multi-RPC setups must agree on canonical blocks)"
                );
                let anc = match find_common_ancestor(
                    pool,
                    &providers,
                    pointer.block_number,
                    &mut rpc_sticky_idx,
                    rpc_metrics,
                )
                .await
                {
                    Ok(a) => a,
                    Err(e) => {
                        if error_chain_has_transport_rpc(&*e) {
                            if error_chain_transport_http_status(&*e) == Some(429) {
                                rpc_health.report_rate_limited();
                            } else {
                                rpc_health.report_failure_debounced();
                            }
                            tracing::warn!(?e, "ingestion: reorg walk RPC failed");
                            tokio::time::sleep(rpc_health.backoff_sleep()).await;
                            continue;
                        }
                        return Err(e);
                    }
                };
                let ab = match rpc_first_some_sticky_instrumented(
                    &providers,
                    &mut rpc_sticky_idx,
                    Some(rpc_metrics),
                    RpcMethod::GetBlockByNumber,
                    RpcCaller::Reorg,
                    |p| p.get_block_by_number(anc.into(), BlockTransactionsKind::Hashes),
                )
                .await
                {
                    Ok(Some(b)) => b,
                    Ok(None) => {
                        rpc_health.report_failure_debounced();
                        tracing::warn!(ancestor = anc, "ingestion: missing ancestor block after RPC");
                        tokio::time::sleep(rpc_health.backoff_sleep()).await;
                        continue;
                    }
                    Err(e) => {
                        if transport_err_http_status(&e) == Some(429) {
                            rpc_health.report_rate_limited();
                        } else {
                            rpc_health.report_failure_debounced();
                        }
                        tracing::warn!(?e, "ingestion: ancestor fetch RPC failed");
                        tokio::time::sleep(rpc_health.backoff_sleep()).await;
                        continue;
                    }
                };
                let ah: B256 = ab.header.hash;
                rollback_after(
                    pool,
                    ChainPointer {
                        block_number: anc,
                        block_hash: ah,
                    },
                )
                .await?;
                pointer = ChainPointer {
                    block_number: anc,
                    block_hash: ah,
                };
                tracing::info!(ancestor = anc, "rolled back after reorg");
                continue;
            }

            let filter = Filter::new().select(next).address(addrs.clone());
            let logs = match rpc_first_ok_sticky_instrumented(
                &providers,
                &mut rpc_sticky_idx,
                Some(rpc_metrics),
                RpcMethod::GetLogs,
                RpcCaller::Ingestion,
                |p| p.get_logs(&filter),
            )
            .await
            {
                Ok(logs) => logs,
                Err(e) => {
                    if transport_err_http_status(&e) == Some(429) {
                        rpc_health.report_rate_limited();
                    } else {
                        rpc_health.report_failure_debounced();
                    }
                    tracing::warn!(
                        next_block = next,
                        rpc_debounced_failure_streak = rpc_health.failure_streak(),
                        ?e,
                        "ingestion: eth_getLogs failed on all RPC endpoints"
                    );
                    tokio::time::sleep(rpc_health.backoff_sleep()).await;
                    continue;
                }
            };

            tracing::debug!(
                block = next,
                log_events = logs.len(),
                block_hash = %block.header.hash,
                "ingestion: fetched block + logs"
            );

            let block_hash: B256 = block.header.hash;
            let pointer_next = ChainPointer {
                block_number: next,
                block_hash,
            };

            let mut tx = pool.begin().await?;
            let ingest_block = async {
                let mut last_buy_epoch_head = LastBuyEpochHead::load(&mut tx).await?;
                for lg in &logs {
                    if lg.removed {
                        continue;
                    }
                    if let Some(decoded) = decode_rpc_log(lg) {
                        persist_decoded_log_conn(&mut tx, &mut last_buy_epoch_head, &decoded).await?;
                        if let Some(arena) = time_arena {
                            if decoded.contract == arena {
                                let provider =
                                    &providers[rpc_sticky_idx % providers.len()];
                                let players = warbow_score::warbow_score_players(&decoded.event);
                                let skip_rpc = matches!(
                                    &decoded.event,
                                    DecodedEvent::ArenaWarbowEpochScore { .. }
                                );
                                if !players.is_empty() && !skip_rpc {
                                    if let Err(e) = warbow_score::snapshot_warbow_players_after_log(
                                        provider,
                                        arena,
                                        &decoded,
                                        &mut tx,
                                        &players,
                                        rpc_metrics,
                                    )
                                    .await
                                    {
                                        tracing::warn!(
                                            block = decoded.block_number,
                                            tx = %decoded.tx_hash,
                                            ?e,
                                            "ingestion: warbow BP snapshot skipped"
                                        );
                                    }
                                }
                                if arena_podium_live::should_snapshot_live_podium(&decoded.event) {
                                    if let Err(e) = arena_podium_live::snapshot_live_podium_after_log(
                                        provider,
                                        arena,
                                        &decoded,
                                        &mut tx,
                                        rpc_metrics,
                                    )
                                    .await
                                    {
                                        tracing::warn!(
                                            block = decoded.block_number,
                                            tx = %decoded.tx_hash,
                                            ?e,
                                            "ingestion: live podium snapshot skipped"
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                upsert_indexed_block_conn(&mut tx, next, block_hash).await?;
                save_chain_pointer_conn(&mut tx, &pointer_next).await?;
                Ok::<_, eyre::Report>(())
            }
            .await;

            match ingest_block {
                Ok(()) => {
                    tx.commit().await?;
                    pointer = pointer_next;
                    rpc_health.report_success();
                    last_null_block_diag_at = None;
                    if let Some(p) = progress {
                        p.mark_indexed_now();
                    }
                    tracing::debug!(block = next, "ingestion: committed block");
                    let now = Instant::now();
                    if next.is_multiple_of(25)
                        || now.duration_since(last_progress_info_at) >= Duration::from_secs(45)
                    {
                        tracing::info!(
                            block = next,
                            chain_pointer_tip = pointer.block_number,
                            "ingestion: checkpoint — block committed"
                        );
                        last_progress_info_at = now;
                    }
                }
                Err(e) => {
                    tx.rollback().await.ok();
                    tracing::warn!(
                        block = next,
                        ?e,
                        "ingestion: block DB transaction failed — rolling back; supervised retry follows"
                    );
                    return Err(e);
                }
            }
        }
    }
    .await;

    if outcome.is_err() {
        if let Some(p) = progress {
            p.ingestion_alive.store(false, Ordering::Release);
        }
    }
    outcome
}

#[cfg(test)]
mod ingestion_tests {
    use super::*;
    use crate::reorg::ChainPointer;

    #[test]
    fn next_block_genesis_sentinel_uses_effective_start() {
        let p = ChainPointer {
            block_number: 0,
            block_hash: B256::ZERO,
        };
        assert_eq!(next_block_to_process(&p, 7), 7);
    }

    #[test]
    fn next_block_after_indexed_tip_is_plus_one() {
        let p = ChainPointer {
            block_number: 10,
            block_hash: B256::from([1u8; 32]),
        };
        assert_eq!(next_block_to_process(&p, 0), 11);
    }
}
