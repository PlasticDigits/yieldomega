// SPDX-License-Identifier: AGPL-3.0-or-later

//! Head RPC snapshot for `GET /v1/timecurve/sale-state` — arena timer basics at chain-timer block tag ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)).

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use eyre::{Result, WrapErr};

/// JSON body for `GET /v1/timecurve/sale-state` (schema ≥ 1.24.0, trimmed for Arena v2).
#[derive(Debug, Clone, serde::Serialize)]
pub struct TimecurveSaleStateSnapshot {
    pub read_block_number: String,
    pub block_timestamp_sec: String,
    pub polled_at_ms: u64,
    pub deadline_sec: String,
    pub total_doub_raised: String,
    pub paused: bool,
}

fn u256_to_decimal_string(v: U256) -> String {
    v.to_string()
}

fn decode_return_u256(data: &[u8]) -> Result<U256> {
    if data.len() < 32 {
        return Err(eyre::eyre!(
            "eth_call return too short: {} bytes",
            data.len()
        ));
    }
    let slice = &data[data.len() - 32..];
    Ok(U256::from_be_slice(slice))
}

fn decode_return_bool(data: &[u8]) -> Result<bool> {
    Ok(!decode_return_u256(data)?.is_zero())
}

async fn eth_call_u256(
    provider: &ReqwestProvider,
    contract: Address,
    block_id: BlockId,
    selector: [u8; 4],
    label: &str,
) -> Result<U256> {
    let req = TransactionRequest::default()
        .to(contract)
        .input(Bytes::copy_from_slice(&selector).into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_return_u256(&raw).wrap_err_with(|| format!("decode {label}"))
}

async fn eth_call_bool(
    provider: &ReqwestProvider,
    contract: Address,
    block_id: BlockId,
    selector: [u8; 4],
    label: &str,
) -> Result<bool> {
    let req = TransactionRequest::default()
        .to(contract)
        .input(Bytes::copy_from_slice(&selector).into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_return_bool(&raw).wrap_err_with(|| format!("decode {label}"))
}

/// Poll arena timer basics at `block_id` (shared head with chain-timer).
pub async fn poll_sale_state_at_block(
    provider: &ReqwestProvider,
    arena: Address,
    block_id: BlockId,
    block_ts: u64,
    read_block_number: u64,
    polled_at_ms: u64,
) -> Result<TimecurveSaleStateSnapshot> {
    const SEL_DEADLINE: [u8; 4] = [0x29, 0xdc, 0xb0, 0xcf];
    const SEL_TOTAL_DOUB_RAISED: [u8; 4] = [0x6d, 0xc8, 0x4f, 0xb3];
    const SEL_PAUSED: [u8; 4] = [0x5c, 0x97, 0x5a, 0xbb];

    let (deadline, total_doub_raised, paused) = tokio::try_join!(
        eth_call_u256(provider, arena, block_id, SEL_DEADLINE, "deadline"),
        eth_call_u256(
            provider,
            arena,
            block_id,
            SEL_TOTAL_DOUB_RAISED,
            "totalDoubRaised"
        ),
        eth_call_bool(provider, arena, block_id, SEL_PAUSED, "paused"),
    )?;

    Ok(TimecurveSaleStateSnapshot {
        read_block_number: read_block_number.to_string(),
        block_timestamp_sec: block_ts.to_string(),
        polled_at_ms,
        deadline_sec: u256_to_decimal_string(deadline),
        total_doub_raised: u256_to_decimal_string(total_doub_raised),
        paused,
    })
}
