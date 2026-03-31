// SPDX-License-Identifier: AGPL-3.0-or-later

//! JSON-RPC polling ingestion (`eth_getBlockByNumber` + `eth_getLogs`).

use std::time::Duration;

use alloy_primitives::B256;
use alloy_provider::{Provider, ProviderBuilder, ReqwestProvider};
use alloy_rpc_types::{BlockTransactionsKind, Filter};
use eyre::{Result, WrapErr};
use sqlx::PgPool;

use crate::config::Config;
use crate::decoder::decode_rpc_log;
use crate::persist::persist_decoded_log;
use crate::reorg::{
    find_common_ancestor, load_chain_pointer, rollback_after, save_chain_pointer,
    upsert_indexed_block, ChainPointer,
};

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
    provider: &ReqwestProvider,
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
    let block = provider
        .get_block_by_number(parent.into(), BlockTransactionsKind::Hashes)
        .await?
        .ok_or_else(|| eyre::eyre!("bootstrap: missing block {parent}"))?;

    let hash: B256 = block.header.hash;
    *pointer = ChainPointer {
        block_number: parent,
        block_hash: hash,
    };
    upsert_indexed_block(pool, parent, hash).await?;
    save_chain_pointer(pool, pointer).await?;
    tracing::info!(
        block = parent,
        %hash,
        "bootstrapped chain pointer before effective_start"
    );
    Ok(())
}

/// Start the ingestion loop. Blocks until cancelled or fatal error.
pub async fn run(pool: &PgPool, config: &Config) -> Result<()> {
    if !config.ingestion_enabled {
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
        tracing::warn!("no contract addresses in ADDRESS_REGISTRY — idle (API only)");
        loop {
            tokio::time::sleep(Duration::from_secs(3600)).await;
        }
    }

    let url: reqwest::Url = config
        .rpc_url
        .parse()
        .wrap_err("invalid RPC_URL (expected http/https URL)")?;
    let provider = ProviderBuilder::new().on_http(url);

    let mut pointer = load_chain_pointer(pool).await?;
    let effective = config.effective_start_block();
    bootstrap_pointer(pool, &provider, &mut pointer, effective).await?;

    tracing::info!(
        addresses = addrs.len(),
        effective_start = effective,
        tip = pointer.block_number,
        "ingestion started"
    );

    loop {
        let next = next_block_to_process(&pointer, effective);

        let Some(block) = provider
            .get_block_by_number(next.into(), BlockTransactionsKind::Hashes)
            .await?
        else {
            tokio::time::sleep(Duration::from_millis(500)).await;
            continue;
        };

        let parent: B256 = block.header.inner.parent_hash;
        if pointer.block_hash != B256::ZERO && parent != pointer.block_hash {
            tracing::warn!(
                next,
                expected_parent = %pointer.block_hash,
                actual_parent = %parent,
                "reorg detected"
            );
            let anc = find_common_ancestor(pool, &provider, pointer.block_number).await?;
            let ab = provider
                .get_block_by_number(anc.into(), BlockTransactionsKind::Hashes)
                .await?
                .ok_or_else(|| eyre::eyre!("missing ancestor block {anc}"))?;
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
        let logs = provider.get_logs(&filter).await?;

        for lg in &logs {
            if lg.removed {
                continue;
            }
            if let Some(decoded) = decode_rpc_log(lg) {
                if let Err(e) = persist_decoded_log(pool, &decoded).await {
                    tracing::error!(?e, "persist log failed");
                }
            }
        }

        let block_hash: B256 = block.header.hash;
        upsert_indexed_block(pool, next, block_hash).await?;
        pointer = ChainPointer {
            block_number: next,
            block_hash,
        };
        save_chain_pointer(pool, &pointer).await?;

        if next.is_multiple_of(100) {
            tracing::debug!(block = next, "indexed block");
        }
    }
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
