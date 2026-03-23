//! Reorg detection and rollback.
//!
//! Strategy overview: see `REORG_STRATEGY.md` in this crate root.
//!
//! The indexer tracks a **canonical chain pointer** — the most recently
//! processed (block_number, block_hash) pair. On each new block:
//!
//! 1. Fetch block N+1 from RPC.
//! 2. Compare its `parent_hash` to the stored `block_hash` for block N.
//! 3. If they match → process normally and advance the pointer.
//! 4. If they diverge → a reorg occurred:
//!    a. Walk backwards through stored blocks until we find the common
//!       ancestor (the deepest block whose hash still matches the chain).
//!    b. Delete all indexed data for orphaned blocks (by block number range).
//!    c. Re-fetch and re-process from the common ancestor.
//!
//! **Stub:** The implementation below defines types and signatures only.

#![allow(dead_code)]

use alloy_primitives::B256;
use eyre::Result;
use sqlx::PgPool;

use crate::config::Config;

/// The indexer's view of where it is on the canonical chain.
#[derive(Debug, Clone)]
pub struct ChainPointer {
    pub block_number: u64,
    pub block_hash: B256,
}

impl ChainPointer {
    /// Load the last-indexed pointer from Postgres, or default to the
    /// configured start block (with a zero hash as sentinel).
    pub async fn load_or_genesis(config: &Config) -> Result<Self> {
        // TODO: SELECT block_number, block_hash FROM indexer_state
        //       WHERE key = 'chain_pointer'
        Ok(Self {
            block_number: config.start_block,
            block_hash: B256::ZERO,
        })
    }

    /// Persist pointer after successfully processing a block.
    pub async fn advance(
        &mut self,
        _pool: &PgPool,
        new_number: u64,
        new_hash: B256,
    ) -> Result<()> {
        // TODO: UPSERT indexer_state SET block_number, block_hash
        self.block_number = new_number;
        self.block_hash = new_hash;
        Ok(())
    }
}

/// Roll back indexed data from `from_block` down to `to_block` (inclusive)
/// and reset the chain pointer to the common ancestor.
///
/// Must run inside a transaction so the rollback is atomic.
pub async fn handle_reorg(
    _pool: &PgPool,
    _pointer: &mut ChainPointer,
    _to_block: u64,
) -> Result<()> {
    // TODO(abi): DELETE FROM each event table WHERE block_number > to_block
    //            then re-set pointer to to_block.
    tracing::warn!("handle_reorg is a stub — no data to roll back yet");
    Ok(())
}
