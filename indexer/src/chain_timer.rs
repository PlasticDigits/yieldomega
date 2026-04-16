// SPDX-License-Identifier: AGPL-3.0-or-later

//! Polls `deadline()`, `timerCapSec()`, and head `block.timestamp` at the same block tag for the hero timer UX.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ProviderBuilder, ReqwestProvider};
use alloy_rpc_types::{BlockId, BlockTransactionsKind, TransactionRequest};
use eyre::{Result, WrapErr};
use tokio::sync::RwLock;
use tokio::time::{interval, Duration, MissedTickBehavior};

/// `deadline()` selector
const SEL_DEADLINE: [u8; 4] = [0x29, 0xdc, 0xb0, 0xcf];
/// `timerCapSec()` selector
const SEL_TIMER_CAP: [u8; 4] = [0x0f, 0x63, 0x25, 0x76];

/// Cached JSON shape for `GET /v1/timecurve/chain-timer` (matches frontend `TimerChainSnapshot` fields).
#[derive(Debug, Clone, serde::Serialize)]
pub struct ChainTimerSnapshot {
    pub deadline_sec: String,
    pub block_timestamp_sec: String,
    pub timer_cap_sec: String,
    pub read_block_number: String,
    /// Millis since Unix epoch when this snapshot was successfully polled.
    pub polled_at_ms: u64,
}

fn u256_to_decimal_string(v: U256) -> String {
    v.to_string()
}

fn decode_return_u256(data: &[u8]) -> Result<U256> {
    if data.len() < 32 {
        return Err(eyre::eyre!("eth_call return too short: {} bytes", data.len()));
    }
    let slice = &data[data.len() - 32..];
    Ok(U256::from_be_slice(slice))
}

/// Runs until process exit; updates `cache` every second on success.
pub async fn run_poll_loop(
    rpc_url: String,
    timecurve: Address,
    cache: Arc<RwLock<Option<ChainTimerSnapshot>>>,
) {
    let url: reqwest::Url = match rpc_url.parse() {
        Ok(u) => u,
        Err(e) => {
            tracing::error!(?e, "chain_timer: invalid RPC_URL");
            return;
        }
    };
    let provider = ProviderBuilder::new().on_http(url);
    let mut ticker = interval(Duration::from_secs(1));
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        ticker.tick().await;
        match poll_once(&provider, timecurve).await {
            Ok(snap) => {
                *cache.write().await = Some(snap);
            }
            Err(e) => {
                tracing::debug!(?e, "chain_timer: poll failed");
            }
        }
    }
}

async fn poll_once(provider: &ReqwestProvider, tc: Address) -> Result<ChainTimerSnapshot> {
    let bn = provider.get_block_number().await?;
    let block = provider
        .get_block_by_number(bn.into(), BlockTransactionsKind::Hashes)
        .await?
        .ok_or_else(|| eyre::eyre!("chain_timer: missing block {bn}"))?;

    let block_ts = block.header.timestamp;
    let block_id = BlockId::Number(bn.into());

    let d_req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&SEL_DEADLINE).into());
    let d_raw = provider
        .call(&d_req)
        .block(block_id.clone())
        .await
        .wrap_err("deadline eth_call")?;
    let deadline = decode_return_u256(&d_raw).wrap_err("decode deadline")?;

    let c_req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&SEL_TIMER_CAP).into());
    let c_raw = provider
        .call(&c_req)
        .block(block_id)
        .await
        .wrap_err("timerCapSec eth_call")?;
    let cap = decode_return_u256(&c_raw).wrap_err("decode timerCapSec")?;

    let polled_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(ChainTimerSnapshot {
        deadline_sec: u256_to_decimal_string(deadline),
        block_timestamp_sec: block_ts.to_string(),
        timer_cap_sec: u256_to_decimal_string(cap),
        read_block_number: bn.to_string(),
        polled_at_ms,
    })
}
