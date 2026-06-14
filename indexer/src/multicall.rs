// SPDX-License-Identifier: AGPL-3.0-or-later

//! Multicall3 `aggregate3` batching for chain-timer head reads ([#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)).

use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};

use alloy_primitives::{address, Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use alloy_sol_types::{sol, SolCall};
use eyre::{bail, Result, WrapErr};

use crate::rpc_http::rpc_first_ok_instrumented;
use crate::rpc_metrics::{RpcCaller, RpcMethod, RpcMetrics};

/// Canonical Multicall3 address (standard on mainnet L2s; Anvil needs `scripts/lib/anvil_multicall3.sh`).
pub const MULTICALL3: Address = address!("0xcA11bde05977b3631167028862bE2a173976CA11");

/// Max sub-calls per `aggregate3` to stay within provider `eth_call` payload limits.
pub const MAX_CALLS_PER_BATCH: usize = 40;

const MC_UNKNOWN: u8 = 0;
const MC_AVAILABLE: u8 = 1;
const MC_UNAVAILABLE: u8 = 2;

static MULTICALL_MODE: AtomicU8 = AtomicU8::new(MC_UNKNOWN);

sol! {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct McResult {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external returns (McResult[] returnData);
}

/// One logical `eth_call` target inside an aggregate batch.
#[derive(Debug, Clone)]
pub struct MulticallRequest {
    pub target: Address,
    pub call_data: Bytes,
}

/// Whether Multicall3 batching should be attempted (cached after first probe).
pub fn multicall_batching_enabled() -> bool {
    MULTICALL_MODE.load(Ordering::Relaxed) != MC_UNAVAILABLE
}

pub fn mark_multicall_unavailable() {
    MULTICALL_MODE.store(MC_UNAVAILABLE, Ordering::Relaxed);
}

/// Probe `eth_getCode` once; caches availability for the process lifetime.
pub async fn probe_multicall3(providers: &[ReqwestProvider]) -> bool {
    match MULTICALL_MODE.load(Ordering::Relaxed) {
        MC_AVAILABLE => return true,
        MC_UNAVAILABLE => return false,
        _ => {}
    }
    let code = rpc_first_ok_instrumented(
        providers,
        None,
        RpcMethod::EthCall,
        RpcCaller::ChainTimer,
        |p| {
            async move {
                p.get_code_at(MULTICALL3)
                    .block_id(BlockId::latest())
                    .await
            }
        },
    )
    .await;
    let available = code
        .map(|c| !c.is_empty())
        .unwrap_or(false);
    MULTICALL_MODE.store(
        if available { MC_AVAILABLE } else { MC_UNAVAILABLE },
        Ordering::Relaxed,
    );
    available
}

/// Coalesce duplicate `(target, calldata)` pairs; returns unique requests + index map into results.
pub fn coalesce_requests(requests: Vec<MulticallRequest>) -> (Vec<MulticallRequest>, Vec<usize>) {
    let mut unique: Vec<MulticallRequest> = Vec::new();
    let mut map: HashMap<(Address, Vec<u8>), usize> = HashMap::new();
    let mut indices = Vec::with_capacity(requests.len());
    for req in requests {
        let key = (req.target, req.call_data.to_vec());
        if let Some(&idx) = map.get(&key) {
            indices.push(idx);
        } else {
            let idx = unique.len();
            map.insert(key, idx);
            unique.push(req);
            indices.push(idx);
        }
    }
    (unique, indices)
}

/// Split requests into chunks of at most [`MAX_CALLS_PER_BATCH`].
pub fn chunk_requests(requests: &[MulticallRequest]) -> Vec<&[MulticallRequest]> {
    if requests.is_empty() {
        return Vec::new();
    }
    requests
        .chunks(MAX_CALLS_PER_BATCH)
        .collect()
}

pub fn decode_return_u256(data: &[u8]) -> Result<U256> {
    if data.len() < 32 {
        return Err(eyre::eyre!(
            "eth_call return too short: {} bytes",
            data.len()
        ));
    }
    Ok(U256::from_be_slice(&data[data.len() - 32..]))
}

pub fn decode_return_address(data: &[u8]) -> Result<Address> {
    if data.len() < 32 {
        return Err(eyre::eyre!(
            "eth_call return too short: {} bytes",
            data.len()
        ));
    }
    Ok(Address::from_word(
        data[data.len() - 32..]
            .try_into()
            .map_err(|_| eyre::eyre!("eth_call address word invalid"))?,
    ))
}

pub fn decode_return_bool(data: &[u8]) -> Result<bool> {
    Ok(!decode_return_u256(data)?.is_zero())
}

/// Run one `aggregate3` batch at `block_id`; records **one** logical `eth_call` in metrics.
pub async fn aggregate3_at_block(
    providers: &[ReqwestProvider],
    block_id: BlockId,
    requests: &[MulticallRequest],
    metrics: &RpcMetrics,
    label: &str,
) -> Result<Vec<Bytes>> {
    if requests.is_empty() {
        return Ok(Vec::new());
    }
    let calls: Vec<Call3> = requests
        .iter()
        .map(|r| Call3 {
            target: r.target,
            allowFailure: false,
            callData: r.call_data.clone(),
        })
        .collect();
    let input = aggregate3Call { calls }.abi_encode();
    let raw = rpc_first_ok_instrumented(
        providers,
        Some(metrics),
        RpcMethod::EthCall,
        RpcCaller::ChainTimer,
        |p| {
            let req = TransactionRequest::default()
                .to(MULTICALL3)
                .input(Bytes::from(input.clone()).into());
            async move { p.call(&req).block(block_id).await }
        },
    )
    .await
    .wrap_err_with(|| format!("{label} aggregate3"))?;

    let decoded = aggregate3Call::abi_decode_returns(&raw, true)
        .wrap_err_with(|| format!("decode {label} aggregate3"))?;
    let mut out = Vec::with_capacity(decoded.returnData.len());
    for (i, r) in decoded.returnData.iter().enumerate() {
        if !r.success {
            bail!("{label} subcall {i} failed");
        }
        out.push(r.returnData.clone());
    }
    Ok(out)
}

/// Run one or more `aggregate3` batches (chunked); coalesces duplicates when `coalesce` is true.
pub async fn aggregate3_batched(
    providers: &[ReqwestProvider],
    block_id: BlockId,
    requests: Vec<MulticallRequest>,
    metrics: &RpcMetrics,
    label: &str,
    coalesce: bool,
) -> Result<Vec<Bytes>> {
    let (unique, index_map) = if coalesce {
        coalesce_requests(requests)
    } else {
        let n = requests.len();
        (requests, (0..n).collect())
    };
    let mut unique_results: Vec<Bytes> = Vec::new();
    for (chunk_idx, chunk) in chunk_requests(&unique).into_iter().enumerate() {
        let chunk_label = if chunk_requests(&unique).len() > 1 {
            format!("{label}[{chunk_idx}]")
        } else {
            label.to_string()
        };
        let mut part =
            aggregate3_at_block(providers, block_id, chunk, metrics, &chunk_label).await?;
        unique_results.append(&mut part);
    }
    Ok(index_map
        .into_iter()
        .map(|i| unique_results[i].clone())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coalesce_dedupes_identical_calls() {
        let arena = Address::repeat_byte(0xab);
        let calldata = Bytes::from_static(&[0x07, 0xf2, 0x87, 0x15]);
        let reqs = vec![
            MulticallRequest {
                target: arena,
                call_data: calldata.clone(),
            },
            MulticallRequest {
                target: arena,
                call_data: calldata.clone(),
            },
        ];
        let (unique, indices) = coalesce_requests(reqs);
        assert_eq!(unique.len(), 1);
        assert_eq!(indices, vec![0, 0]);
    }

    #[test]
    fn decode_u256_from_32_byte_word() {
        let mut word = [0u8; 32];
        word[31] = 42;
        assert_eq!(decode_return_u256(&word).unwrap(), U256::from(42));
    }

    #[test]
    fn decode_address_from_word() {
        let mut word = [0u8; 32];
        word[12..32].copy_from_slice(&[0x11; 20]);
        let addr = decode_return_address(&word).unwrap();
        assert_eq!(addr, Address::repeat_byte(0x11));
    }

    #[test]
    fn aggregate3_call_encodes_non_empty() {
        let calls = vec![Call3 {
            target: Address::repeat_byte(0x01),
            allowFailure: false,
            callData: Bytes::from_static(&[0xde, 0xad, 0xbe, 0xef]),
        }];
        let encoded = aggregate3Call { calls }.abi_encode();
        assert!(encoded.len() > 4);
        assert_eq!(&encoded[..4], &[0x82, 0xad, 0x56, 0xcb]); // aggregate3 selector
    }
}
