// SPDX-License-Identifier: AGPL-3.0-or-later

//! Live DOUB/USD spot from Kumbaya QuoterV2 USDM→DOUB swap simulation (1 WAD DOUB out).

use std::sync::Arc;
use std::time::Duration;

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use alloy_sol_types::{sol, SolCall};
use eyre::{Context, ContextCompat, Result};
use tokio::sync::RwLock;

use crate::chain_timer::TimecurveHeadSnapshot;
use crate::rpc_http::rpc_first_ok_instrumented;
use crate::rpc_metrics::{RpcCaller, RpcMethod, RpcMetrics};

/// USDM has 6 decimals; DOUB/USD display wad uses 18 — `doub_usd_wad = usdm_in * 10^12`.
const USDM_FROM_DOUB_DECIMAL_SCALE: u128 = 10u128.pow(12);
fn wad() -> U256 {
    U256::from(10u128.pow(18))
}

sol! {
    struct QuoteExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amount;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    contract KumbayaQuoterV2 {
        function quoteExactOutputSingle(QuoteExactOutputSingleParams params)
            external
            returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate);
    }
}

/// Cached QuoterV2 snapshot served on `GET /v1/arena/doub-spot-price`.
#[derive(Debug, Clone)]
pub struct DoubSpotPriceSnapshot {
    /// USDM smallest units (6 decimals) to buy exactly 1 DOUB (`1e18` wei).
    pub usdm_per_doub_wad: String,
    /// 18-decimal USD-notional wad per 1 DOUB for frontend `usdWad = doubWei * doub_usd_wad / WAD`.
    pub doub_usd_wad: String,
    pub polled_at_ms: u64,
    pub read_block_number: String,
}

/// Kumbaya pool routing for the USDM→WETH→CL8Y→DOUB quote path.
#[derive(Debug, Clone)]
pub struct KumbayaSpotConfig {
    pub quoter: Address,
    pub usdm: Address,
    pub weth: Address,
    pub cl8y: Address,
    pub doub_cl8y_fee: u32,
    pub cl8y_weth_fee: u32,
    pub usdm_weth_fee: u32,
}

fn env_addr(key: &str) -> Option<Address> {
    std::env::var(key)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .and_then(|s| s.parse().ok())
}

fn env_fee(key: &str, fallback: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .filter(|n| *n <= 0xffffff)
        .unwrap_or(fallback)
}

struct ChainKumbayaDefaults {
    weth: Address,
    usdm: Option<Address>,
    quoter: Address,
    doub_cl8y_fee: u32,
    cl8y_weth_fee: u32,
    usdm_weth_fee: u32,
}

fn chain_kumbaya_defaults(chain_id: u64) -> Option<ChainKumbayaDefaults> {
    match chain_id {
        4326 => Some(ChainKumbayaDefaults {
            weth: "0x4200000000000000000000000000000000000006"
                .parse()
                .expect("weth"),
            usdm: Some(
                "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"
                    .parse()
                    .expect("usdm"),
            ),
            quoter: "0x1F1a8dC7E138C34b503Ca080962aC10B75384a27"
                .parse()
                .expect("quoter"),
            doub_cl8y_fee: 100,
            cl8y_weth_fee: 100,
            usdm_weth_fee: 3000,
        }),
        6343 => Some(ChainKumbayaDefaults {
            weth: "0x4200000000000000000000000000000000000006"
                .parse()
                .expect("weth"),
            usdm: None,
            quoter: "0xfb230b93803F90238cB03f254452bA3a3b0Ec38d"
                .parse()
                .expect("quoter"),
            doub_cl8y_fee: 100,
            cl8y_weth_fee: 3000,
            usdm_weth_fee: 3000,
        }),
        31337 => Some(ChainKumbayaDefaults {
            weth: Address::ZERO,
            usdm: None,
            quoter: Address::ZERO,
            doub_cl8y_fee: 100,
            cl8y_weth_fee: 100,
            usdm_weth_fee: 3000,
        }),
        _ => None,
    }
}

/// Resolve Kumbaya addresses/fees from chain table + `INDEXER_KUMBAYA_*` env overrides.
pub fn kumbaya_spot_config_from_env(
    chain_id: u64,
    cl8y_reserve: Option<Address>,
) -> Option<KumbayaSpotConfig> {
    let defaults = chain_kumbaya_defaults(chain_id)?;
    let weth = env_addr("INDEXER_KUMBAYA_WETH").unwrap_or(defaults.weth);
    let usdm = env_addr("INDEXER_KUMBAYA_USDM").or(defaults.usdm)?;
    let quoter = env_addr("INDEXER_KUMBAYA_QUOTER").unwrap_or(defaults.quoter);
    let cl8y = env_addr("INDEXER_KUMBAYA_CL8Y").or(cl8y_reserve)?;
    if weth.is_zero() || usdm.is_zero() || quoter.is_zero() || cl8y.is_zero() {
        return None;
    }
    Some(KumbayaSpotConfig {
        quoter,
        usdm,
        weth,
        cl8y,
        doub_cl8y_fee: env_fee("INDEXER_KUMBAYA_FEE_DOUB_CL8Y", defaults.doub_cl8y_fee),
        cl8y_weth_fee: env_fee("INDEXER_KUMBAYA_FEE_CL8Y_WETH", defaults.cl8y_weth_fee),
        usdm_weth_fee: env_fee("INDEXER_KUMBAYA_FEE_USDM_WETH", defaults.usdm_weth_fee),
    })
}

pub fn usdm_in_to_doub_usd_wad(usdm_in: U256) -> U256 {
    U256::from(USDM_FROM_DOUB_DECIMAL_SCALE) * usdm_in
}

fn poll_interval_ms() -> u64 {
    std::env::var("INDEXER_DOUB_SPOT_POLL_MS")
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(60_000)
        .clamp(5_000, 600_000)
}

async fn eth_call(
    providers: &[ReqwestProvider],
    contract: Address,
    input: Bytes,
    label: &str,
    metrics: &RpcMetrics,
) -> Result<Bytes> {
    rpc_first_ok_instrumented(
        providers,
        Some(metrics),
        RpcMethod::EthCall,
        RpcCaller::DoubSpotPrice,
        |p| {
            let req = TransactionRequest::default()
                .to(contract)
                .input(input.clone().into());
            async move { p.call(&req).block(BlockId::latest()).await }
        },
    )
    .await
    .wrap_err_with(|| format!("{label} eth_call"))
}

#[allow(clippy::too_many_arguments)]
async fn quote_exact_output_single(
    providers: &[ReqwestProvider],
    quoter: Address,
    token_in: Address,
    token_out: Address,
    amount_out: U256,
    fee: u32,
    label: &str,
    metrics: &RpcMetrics,
) -> Result<U256> {
    let call = KumbayaQuoterV2::quoteExactOutputSingleCall {
        params: QuoteExactOutputSingleParams {
            tokenIn: token_in,
            tokenOut: token_out,
            amount: amount_out,
            fee: alloy_primitives::Uint::<24, 1>::from(fee),
            sqrtPriceLimitX96: alloy_primitives::Uint::<160, 3>::ZERO,
        },
    };
    let raw = eth_call(providers, quoter, Bytes::from(call.abi_encode()), label, metrics).await?;
    let decoded = KumbayaQuoterV2::quoteExactOutputSingleCall::abi_decode_returns(
        raw.as_ref(),
        false,
    )
    .wrap_err_with(|| format!("decode {label}"))?;
    Ok(decoded.amountIn)
}

/// USDM input to receive exactly `doub_amount_out` DOUB via CL8Y→DOUB, WETH→CL8Y, USDM→WETH hops.
pub async fn quote_usdm_for_doub_out(
    providers: &[ReqwestProvider],
    config: &KumbayaSpotConfig,
    doub_address: Address,
    doub_amount_out: U256,
    metrics: &RpcMetrics,
) -> Result<U256> {
    let cl8y_in = quote_exact_output_single(
        providers,
        config.quoter,
        config.cl8y,
        doub_address,
        doub_amount_out,
        config.doub_cl8y_fee,
        "doub_cl8y",
        metrics,
    )
    .await?;
    let weth_in = quote_exact_output_single(
        providers,
        config.quoter,
        config.weth,
        config.cl8y,
        cl8y_in,
        config.cl8y_weth_fee,
        "cl8y_weth",
        metrics,
    )
    .await?;
    quote_exact_output_single(
        providers,
        config.quoter,
        config.usdm,
        config.weth,
        weth_in,
        config.usdm_weth_fee,
        "usdm_weth",
        metrics,
    )
    .await
}

fn doub_address_from_head(head: &TimecurveHeadSnapshot) -> Option<Address> {
    let raw = head.sale_head.doub.trim();
    if raw.is_empty() || raw == "0" {
        return None;
    }
    let addr: Address = raw.parse().ok()?;
    if addr.is_zero() {
        return None;
    }
    Some(addr)
}

pub async fn poll_once(
    providers: &[ReqwestProvider],
    kumbaya: &KumbayaSpotConfig,
    head: &TimecurveHeadSnapshot,
    metrics: &RpcMetrics,
) -> Result<DoubSpotPriceSnapshot> {
    let doub = doub_address_from_head(head).wrap_err("missing DOUB token address on chain timer head")?;
    let usdm_in = quote_usdm_for_doub_out(providers, kumbaya, doub, wad(), metrics).await?;
    if usdm_in.is_zero() {
        eyre::bail!("quoter returned zero USDM for 1 DOUB");
    }
    let doub_usd_wad = usdm_in_to_doub_usd_wad(usdm_in);
    Ok(DoubSpotPriceSnapshot {
        usdm_per_doub_wad: usdm_in.to_string(),
        doub_usd_wad: doub_usd_wad.to_string(),
        polled_at_ms: head.timer.polled_at_ms,
        read_block_number: head.timer.read_block_number.clone(),
    })
}

/// Background loop — polls Kumbaya spot price about once per minute.
pub async fn run_poll_loop(
    rpc_urls: &[String],
    rpc_timeout: Duration,
    kumbaya: KumbayaSpotConfig,
    chain_timer: Arc<RwLock<Option<TimecurveHeadSnapshot>>>,
    cache: Arc<RwLock<Option<DoubSpotPriceSnapshot>>>,
    metrics: RpcMetrics,
) {
    let providers = match crate::rpc_http::parse_http_rpc_urls(rpc_urls)
        .and_then(|urls| crate::rpc_http::build_reqwest_providers(&urls, rpc_timeout))
    {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(?e, "doub_spot_price: failed to build RPC providers");
            return;
        }
    };

    let interval = Duration::from_millis(poll_interval_ms());
    tracing::info!(
        poll_ms = interval.as_millis(),
        quoter = %kumbaya.quoter,
        "doub_spot_price poll loop started"
    );

    loop {
        let head = chain_timer.read().await.clone();
        match head.as_ref() {
            None => tracing::debug!("doub_spot_price: chain timer unavailable; skipping"),
            Some(h) => match poll_once(&providers, &kumbaya, h, &metrics).await {
                Ok(snap) => {
                    tracing::debug!(
                        usdm_per_doub = %snap.usdm_per_doub_wad,
                        doub_usd_wad = %snap.doub_usd_wad,
                        block = %snap.read_block_number,
                        "doub_spot_price updated"
                    );
                    *cache.write().await = Some(snap);
                }
                Err(e) => tracing::warn!(?e, "doub_spot_price poll failed"),
            },
        }
        tokio::time::sleep(interval).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usdm_in_to_doub_usd_wad_scales_six_to_eighteen_decimals() {
        let usdm = U256::from(980_000u64);
        assert_eq!(
            usdm_in_to_doub_usd_wad(usdm),
            U256::from(980_000u64) * U256::from(USDM_FROM_DOUB_DECIMAL_SCALE)
        );
    }
}
