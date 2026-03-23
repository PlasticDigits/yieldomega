//! Block ingestion loop.
//!
//! Follows the MegaETH chain head via JSON-RPC polling (≈1 s block time).
//! When streaming / WebSocket `newHeads` support is confirmed for MegaETH,
//! the polling path should be replaced or complemented.
//!
//! **Stub:** actual RPC calls are not implemented — contract ABIs and
//! confirmed RPC methods are prerequisites.

use eyre::Result;
use sqlx::PgPool;

use crate::config::Config;
use crate::reorg::ChainPointer;

/// Start the ingestion loop. Blocks the current task until cancelled.
///
/// High-level flow:
/// 1. Read `chain_pointer` (last indexed block) from Postgres.
/// 2. Fetch the next block from RPC.
/// 3. If parent hash matches pointer → process normally.
/// 4. If parent hash diverges → invoke [`crate::reorg::handle_reorg`].
/// 5. Decode logs via [`decoder::decode_logs`] and persist.
/// 6. Advance pointer.
pub async fn run(_pool: &PgPool, _config: &Config) -> Result<()> {
    let pointer = ChainPointer::load_or_genesis(_config).await?;
    tracing::info!(block = pointer.block_number, "ingestion starting");

    loop {
        // TODO(abi): Replace with real RPC call once MegaETH JSON-RPC is confirmed.
        // let block = rpc_client.get_block(pointer.block_number + 1).await?;

        // TODO: compare block.parent_hash vs pointer.block_hash
        //       → reorg::handle_reorg if mismatch

        // TODO: decode_logs(&block.logs, &decoder::AbiRegistry::stub())
        //       → persist decoded events

        // TODO: pointer.advance(block_number, block_hash)

        // Poll interval roughly matches MegaETH block time.
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Temporary: break immediately so the binary doesn't spin.
        // Remove once RPC calls are wired.
        tracing::warn!("ingestion loop is a stub — exiting");
        break;
    }

    let _ = pointer; // suppress unused warning in stub
    Ok(())
}
