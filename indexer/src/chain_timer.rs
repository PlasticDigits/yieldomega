// SPDX-License-Identifier: AGPL-3.0-or-later

//! Polls `saleStart()`, `deadline()`, `timerCapSec()`, head `block.timestamp`, `ended()`, and
//! `podium(category)` at the same block tag (hero timer + reserve podium reads).
//!
//! Uses the same comma-separated RPC fallback and adaptive poll backoff as the frontend
//! (`rpcConnectivity` / `wagmi` transports).

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, BlockTransactionsKind, TransactionRequest};
use eyre::{Result, WrapErr};
use tokio::sync::RwLock;
use tokio::time::Duration;

use crate::rpc_http::{
    build_reqwest_providers, error_chain_transport_http_status, parse_http_rpc_urls,
};
use crate::rpc_poll_health::RpcPollHealth;

/// `saleStart()` selector (public getter)
pub const SEL_SALE_START: [u8; 4] = [0xab, 0x0b, 0xcc, 0x41];
/// `deadline()` selector
pub const SEL_DEADLINE: [u8; 4] = [0x29, 0xdc, 0xb0, 0xcf];
/// `timerCapSec()` selector
pub const SEL_TIMER_CAP: [u8; 4] = [0x0f, 0x63, 0x25, 0x76];
/// `ended()` selector
pub const SEL_ENDED: [u8; 4] = [0x12, 0xfa, 0x6f, 0xeb];
/// `podium(uint8)` selector
const SEL_PODIUM: [u8; 4] = [0x14, 0x58, 0xd4, 0xad];

/// Cached JSON shape for `GET /v1/timecurve/chain-timer` (matches frontend `TimerChainSnapshot` fields).
#[derive(Debug, Clone, serde::Serialize)]
pub struct ChainTimerSnapshot {
    /// `TimeCurve.saleStart()` at `read_block_number` (`"0"` when not scheduled).
    pub sale_start_sec: String,
    pub deadline_sec: String,
    pub block_timestamp_sec: String,
    pub timer_cap_sec: String,
    pub read_block_number: String,
    /// Millis since Unix epoch when this snapshot was successfully polled.
    pub polled_at_ms: u64,
}

/// One `TimeCurve.podium(category)` row (`address[3]`, `uint256[3]`).
#[derive(Debug, Clone, serde::Serialize)]
pub struct PodiumRpcRow {
    pub winners: [String; 3],
    pub values: [String; 3],
}

/// Head RPC snapshot at a single block: timer fields plus onchain podium reads (contract category order 0..=3).
#[derive(Debug, Clone, serde::Serialize)]
pub struct TimecurveHeadSnapshot {
    pub timer: ChainTimerSnapshot,
    pub sale_ended: bool,
    /// Index = `TimeCurve` podium category: `0` last buy · `1` time booster · `2` defended streak · `3` WarBow.
    pub podium_contract: [PodiumRpcRow; 4],
    /// Full sale-state views at the same `read_block_number` ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)).
    pub sale_state: crate::sale_state::TimecurveSaleStateSnapshot,
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

fn addr_word_hex(a: Address) -> String {
    format!("{:#x}", a)
}

fn decode_podium_return(data: &[u8]) -> Result<PodiumRpcRow> {
    if data.len() < 32 * 6 {
        return Err(eyre::eyre!(
            "podium eth_call return too short: {} bytes",
            data.len()
        ));
    }
    let mut winners = [
        addr_word_hex(Address::ZERO),
        addr_word_hex(Address::ZERO),
        addr_word_hex(Address::ZERO),
    ];
    let mut values = [String::from("0"), String::from("0"), String::from("0")];
    for (i, winner) in winners.iter_mut().enumerate() {
        let off = i * 32;
        let w = Address::from_word(
            data[off..off + 32]
                .try_into()
                .map_err(|_| eyre::eyre!("podium winner word"))?,
        );
        *winner = addr_word_hex(w);
    }
    for (i, value) in values.iter_mut().enumerate() {
        let off = (3 + i) * 32;
        let v = U256::from_be_slice(&data[off..off + 32]);
        *value = u256_to_decimal_string(v);
    }
    Ok(PodiumRpcRow { winners, values })
}

fn encode_podium_call(category: u8) -> Bytes {
    let mut buf = Vec::with_capacity(36);
    buf.extend_from_slice(&SEL_PODIUM);
    let mut word = [0u8; 32];
    word[31] = category;
    buf.extend_from_slice(&word);
    Bytes::from(buf)
}

fn empty_podium_row() -> PodiumRpcRow {
    PodiumRpcRow {
        winners: std::array::from_fn(|_| addr_word_hex(Address::ZERO)),
        values: std::array::from_fn(|_| String::from("0")),
    }
}

/// Runs until process exit; updates `cache` on success using **1s** healthy cadence and frontend-aligned backoff.
pub async fn run_poll_loop(
    rpc_urls: &[String],
    timecurve: Address,
    cache: Arc<RwLock<Option<TimecurveHeadSnapshot>>>,
    rpc_request_timeout: Duration,
) {
    let parsed = match parse_http_rpc_urls(rpc_urls) {
        Ok(u) => u,
        Err(e) => {
            tracing::error!(?e, "chain_timer: invalid RPC_URL list");
            return;
        }
    };
    let providers = match build_reqwest_providers(&parsed, rpc_request_timeout) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(?e, "chain_timer: failed to build RPC clients");
            return;
        }
    };

    let mut health = RpcPollHealth::new();

    loop {
        match poll_any_provider(&providers, timecurve).await {
            Ok(snap) => {
                health.report_success();
                *cache.write().await = Some(snap);
            }
            Err(e) => {
                tracing::debug!(?e, "chain_timer: poll failed");
                if error_chain_transport_http_status(&*e) == Some(429) {
                    health.report_rate_limited();
                } else {
                    health.report_failure_debounced();
                }
            }
        }
        tokio::time::sleep(health.backoff_sleep()).await;
    }
}

async fn poll_any_provider(
    providers: &[ReqwestProvider],
    tc: Address,
) -> Result<TimecurveHeadSnapshot> {
    let mut last_err = None;
    for p in providers {
        match poll_once(p, tc).await {
            Ok(s) => return Ok(s),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.expect("chain_timer: non-empty RPC providers"))
}

async fn poll_once(provider: &ReqwestProvider, tc: Address) -> Result<TimecurveHeadSnapshot> {
    let bn = provider.get_block_number().await?;
    let block = provider
        .get_block_by_number(bn.into(), BlockTransactionsKind::Hashes)
        .await?
        .ok_or_else(|| eyre::eyre!("chain_timer: missing block {bn}"))?;

    let block_ts = block.header.timestamp;
    let block_id = BlockId::Number(bn.into());

    let s_req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&SEL_SALE_START).into());
    let s_raw = provider
        .call(&s_req)
        .block(block_id)
        .await
        .wrap_err("saleStart eth_call")?;
    let sale_start = decode_return_u256(&s_raw).wrap_err("decode saleStart")?;

    let d_req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&SEL_DEADLINE).into());
    let d_raw = provider
        .call(&d_req)
        .block(block_id)
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

    let e_req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&SEL_ENDED).into());
    let e_raw = provider
        .call(&e_req)
        .block(block_id)
        .await
        .wrap_err("ended eth_call")?;
    let sale_ended = decode_return_bool(&e_raw).wrap_err("decode ended")?;

    let mut podium_rows = std::array::from_fn(|_| empty_podium_row());

    for cat in 0u8..=3 {
        let p_req = TransactionRequest::default()
            .to(tc)
            .input(encode_podium_call(cat).into());
        let p_raw = provider
            .call(&p_req)
            .block(block_id)
            .await
            .wrap_err(format!("podium({cat}) eth_call"))?;
        podium_rows[cat as usize] =
            decode_podium_return(&p_raw).wrap_err(format!("decode podium({cat})"))?;
    }

    let polled_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let timer = ChainTimerSnapshot {
        sale_start_sec: u256_to_decimal_string(sale_start),
        deadline_sec: u256_to_decimal_string(deadline),
        block_timestamp_sec: block_ts.to_string(),
        timer_cap_sec: u256_to_decimal_string(cap),
        read_block_number: bn.to_string(),
        polled_at_ms,
    };

    let sale_state = crate::sale_state::poll_sale_state_at_block(
        provider,
        tc,
        block_id,
        block_ts,
        bn,
        polled_at_ms,
    )
    .await?;

    Ok(TimecurveHeadSnapshot {
        timer,
        sale_ended,
        podium_contract: podium_rows,
        sale_state,
    })
}
