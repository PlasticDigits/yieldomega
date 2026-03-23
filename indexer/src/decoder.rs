//! ABI-based event decoder.
//!
//! **Stub — not semantically complete.**
//!
//! This module will hold the mapping from `topic0` (event selector) to decoded
//! event structs once contract ABIs are finalised. Until then it exposes type
//! scaffolding so the rest of the crate can compile and integration tests can
//! target a stable interface.
//!
//! Contracts that must emit indexable events (see `docs/indexer/design.md`):
//!
//! - **TimeCurve** — sales, buys, prize claims
//! - **RabbitTreasury / Burrow** — epoch lifecycle, deposits/withdrawals,
//!   reserve snapshots, fee accrual, repricing
//!   (canonical event names in `docs/product/rabbit-treasury.md`)
//! - **Leprechaun NFTs** — mints, transfers, trait updates
//!
//! When ABIs land (as JSON artifacts or `sol!` macro input), replace the
//! placeholder types below with generated decoder logic.

#![allow(dead_code)] // Stubs — entire module is unused until ABIs exist.

use alloy_primitives::{B256, Log as RawLog};

/// Registry of known event selectors → decoders.
///
/// Stub: currently empty. Will be populated from contract ABI artifacts.
pub struct AbiRegistry {
    _private: (),
}

impl AbiRegistry {
    /// Return an empty registry. Real implementation will load ABI JSON.
    pub fn stub() -> Self {
        Self { _private: () }
    }
}

/// A decoded, typed event ready for persistence.
///
/// This enum will grow a variant per indexable event once ABIs exist.
#[derive(Debug)]
pub enum DecodedEvent {
    /// Placeholder — unknown or unrecognised log.
    Unknown { topic0: B256 },
}

/// Attempt to decode raw logs using the registry.
///
/// Unknown selectors are collected as [`DecodedEvent::Unknown`]; the caller
/// decides whether to warn or persist them.
pub fn decode_logs(logs: &[RawLog], _registry: &AbiRegistry) -> Vec<DecodedEvent> {
    logs.iter()
        .map(|log| {
            let topic0 = log
                .topics()
                .first()
                .copied()
                .unwrap_or(B256::ZERO);
            // TODO(abi): Match topic0 against registry and decode data.
            DecodedEvent::Unknown { topic0 }
        })
        .collect()
}
