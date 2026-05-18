// SPDX-License-Identifier: AGPL-3.0-or-later

//! JSON-RPC polling ingestion (`eth_getBlockByNumber` + `eth_getLogs`).

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use alloy_primitives::B256;
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockTransactionsKind, Filter};
use eyre::Result;
use sqlx::PgPool;

use crate::config::Config;
use crate::decoder::decode_rpc_log;
use crate::persist::persist_decoded_log_conn;
use crate::reorg::{
    find_common_ancestor, load_chain_pointer, rollback_after, save_chain_pointer_conn,
    upsert_indexed_block_conn, ChainPointer,
};
use crate::rpc_http::{
    build_reqwest_providers, error_chain_has_transport_rpc, error_chain_transport_http_status,
    parse_http_rpc_urls, rpc_first_ok, transport_err_http_status,
};
use crate::rpc_poll_health::RpcPollHealth;

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
) -> Result<()> {
    if effective_start == 0 {
        return Ok(());
    }
    if pointer.block_hash != B256::ZERO || pointer.block_number != 0 {
        return Ok(());
    }

    let parent = effective_start.saturating_sub(1);
    let block = rpc_first_ok(providers, |p| {
        p.get_block_by_number(parent.into(), BlockTransactionsKind::Hashes)
    })
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

    let mut rpc_health = RpcPollHealth::new();

    let mut pointer = load_chain_pointer(pool).await?;
    let effective = config.effective_start_block();
    bootstrap_pointer(pool, &providers, &mut pointer, effective).await?;

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
        loop {
            let next = next_block_to_process(&pointer, effective);

            let block = match rpc_first_ok(&providers, |p| {
                p.get_block_by_number(next.into(), BlockTransactionsKind::Hashes)
            })
            .await
            {
                Ok(Some(b)) => b,
                Ok(None) => {
                    rpc_health.report_success();
                    tokio::time::sleep(rpc_health.backoff_sleep()).await;
                    continue;
                }
                Err(e) => {
                    if transport_err_http_status(&e) == Some(429) {
                        rpc_health.report_rate_limited();
                    } else {
                        rpc_health.report_failure_debounced();
                    }
                    tracing::warn!(?e, "ingestion: JSON-RPC failed on all endpoints");
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
                    "reorg detected"
                );
                let anc = match find_common_ancestor(pool, &providers, pointer.block_number).await {
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
                let ab = match rpc_first_ok(&providers, |p| {
                    p.get_block_by_number(anc.into(), BlockTransactionsKind::Hashes)
                })
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
            let logs = match rpc_first_ok(&providers, |p| p.get_logs(&filter)).await {
                Ok(logs) => logs,
                Err(e) => {
                    if transport_err_http_status(&e) == Some(429) {
                        rpc_health.report_rate_limited();
                    } else {
                        rpc_health.report_failure_debounced();
                    }
                    tracing::warn!(?e, "ingestion: eth_getLogs failed on all endpoints");
                    tokio::time::sleep(rpc_health.backoff_sleep()).await;
                    continue;
                }
            };

            let block_hash: B256 = block.header.hash;
            let pointer_next = ChainPointer {
                block_number: next,
                block_hash,
            };

            let mut tx = pool.begin().await?;
            let ingest_block = async {
                for lg in &logs {
                    if lg.removed {
                        continue;
                    }
                    if let Some(decoded) = decode_rpc_log(lg) {
                        persist_decoded_log_conn(&mut tx, &decoded).await?;
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
                    if let Some(p) = progress {
                        p.mark_indexed_now();
                    }
                }
                Err(e) => {
                    tx.rollback().await.ok();
                    return Err(e);
                }
            }

            if next.is_multiple_of(100) {
                tracing::debug!(block = next, "indexed block");
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
