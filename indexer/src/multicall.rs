// SPDX-License-Identifier: AGPL-3.0-or-later

//! Multicall3 `aggregate3` batching for chain-timer head reads ([#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)).

use std::collections::HashMap;

use alloy_primitives::{Address, Bytes};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use alloy_sol_types::{sol, SolCall};
use eyre::{bail, Result, WrapErr};

use crate::rpc_http::rpc_first_ok_instrumented;
use crate::rpc_metrics::{RpcCaller, RpcMethod, RpcMetrics};

/// Canonical Multicall3 deployment (Anvil + most EVM chains).
pub const MULTICALL3_ADDRESS: Address = Address::new([
    0xca, 0x11, 0xbd, 0xe0, 0x59, 0x77, 0xb3, 0x63, 0x11, 0x67, 0x02, 0x88, 0x62, 0xbe, 0x2a,
    0x17, 0x39, 0x76, 0xca, 0x11,
]);

sol! {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }
    struct Aggregate3Result {
        bool success;
        bytes returnData;
    }
    function aggregate3(Call3[] calldata calls) external returns (Aggregate3Result[] returnData);
}

/// One sub-call inside an `aggregate3` batch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MulticallSubcall {
    pub target: Address,
    pub call_data: Bytes,
}

/// Builder that coalesces duplicate `(target, callData)` pairs at the same block tag.
#[derive(Debug, Default)]
pub struct MulticallBatch {
    calls: Vec<MulticallSubcall>,
    dedupe: HashMap<(Address, Vec<u8>), usize>,
}

impl MulticallBatch {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.calls.len()
    }

    pub fn is_empty(&self) -> bool {
        self.calls.is_empty()
    }

    /// Push a sub-call; returns the result index (reuses index for duplicates).
    pub fn push(&mut self, target: Address, call_data: Bytes) -> usize {
        let key = (target, call_data.to_vec());
        if let Some(&idx) = self.dedupe.get(&key) {
            return idx;
        }
        let idx = self.calls.len();
        self.calls.push(MulticallSubcall { target, call_data });
        self.dedupe.insert(key, idx);
        idx
    }

    pub fn push_selector(&mut self, target: Address, selector: [u8; 4]) -> usize {
        self.push(target, Bytes::copy_from_slice(&selector))
    }

    pub fn push_u8_arg(&mut self, target: Address, selector: [u8; 4], arg: u8) -> usize {
        let mut buf = Vec::with_capacity(36);
        buf.extend_from_slice(&selector);
        let mut word = [0u8; 32];
        word[31] = arg;
        buf.extend_from_slice(&word);
        self.push(target, Bytes::from(buf))
    }
}

/// Execute `aggregate3` with `allowFailure: false` for every sub-call.
///
/// Records **one** logical `eth_call` in [`RpcMetrics`], not one per inner call.
pub async fn aggregate3_at_block(
    providers: &[ReqwestProvider],
    block_id: BlockId,
    batch: &MulticallBatch,
    metrics: &RpcMetrics,
    caller: RpcCaller,
) -> Result<Vec<Bytes>> {
    if batch.is_empty() {
        return Ok(Vec::new());
    }

    let call3s: Vec<Call3> = batch
        .calls
        .iter()
        .map(|c| Call3 {
            target: c.target,
            allowFailure: false,
            callData: c.call_data.clone(),
        })
        .collect();

    let input = aggregate3Call { calls: call3s }.abi_encode();

    let raw = rpc_first_ok_instrumented(
        providers,
        Some(metrics),
        RpcMethod::EthCall,
        caller,
        |p| {
            let req = TransactionRequest::default()
                .to(MULTICALL3_ADDRESS)
                .input(input.clone().into());
            async move { p.call(&req).block(block_id).await }
        },
    )
    .await
    .wrap_err("Multicall3 aggregate3 eth_call")?;

    decode_aggregate3_results(&raw, batch.len())
}

fn decode_aggregate3_results(raw: &[u8], expected_len: usize) -> Result<Vec<Bytes>> {
    let decoded = aggregate3Call::abi_decode_returns(raw, true)
        .wrap_err("decode Multicall3 aggregate3 return")?;
    if decoded.returnData.len() != expected_len {
        bail!(
            "aggregate3 result count mismatch: expected {expected_len}, got {}",
            decoded.returnData.len()
        );
    }
    let mut out = Vec::with_capacity(expected_len);
    for (i, row) in decoded.returnData.into_iter().enumerate() {
        if !row.success {
            bail!("aggregate3 sub-call {i} failed");
        }
        out.push(row.returnData);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_dedupes_identical_subcalls() {
        let arena = Address::repeat_byte(0xab);
        let mut batch = MulticallBatch::new();
        let i0 = batch.push_selector(arena, [0x29, 0xdc, 0xb0, 0xcf]);
        let i1 = batch.push_selector(arena, [0x6a, 0x9e, 0xa0, 0x67]);
        let i2 = batch.push_selector(arena, [0x29, 0xdc, 0xb0, 0xcf]);
        assert_eq!(batch.len(), 2);
        assert_eq!(i0, i2);
        assert_ne!(i0, i1);
    }

    #[test]
    fn decode_aggregate3_results_rejects_failed_subcall() {
        let encoded = aggregate3Call::abi_encode_returns(&(
            vec![Aggregate3Result {
                success: false,
                returnData: Bytes::new(),
            }],
        ));
        let err = decode_aggregate3_results(&encoded, 1).unwrap_err();
        assert!(err.to_string().contains("sub-call 0 failed"));
    }

    #[test]
    fn decode_aggregate3_results_roundtrip_u256() {
        let mut word = [0u8; 32];
        word[31] = 42;
        let encoded = aggregate3Call::abi_encode_returns(&(
            vec![Aggregate3Result {
                success: true,
                returnData: Bytes::copy_from_slice(&word),
            }],
        ));
        let rows = decode_aggregate3_results(&encoded, 1).unwrap();
        assert_eq!(rows[0].len(), 32);
        assert_eq!(rows[0][31], 42);
    }
}
