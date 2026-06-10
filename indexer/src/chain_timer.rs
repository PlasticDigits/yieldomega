// SPDX-License-Identifier: AGPL-3.0-or-later

//! Polls `TimeArena` head state for `GET /v1/arena/timers` and podium reads.

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
use crate::sale_state::TimecurveSaleStateSnapshot;

pub const SEL_ARENA_START: [u8; 4] = [0x07, 0xf2, 0x87, 0x15];
pub const SEL_DEADLINE: [u8; 4] = [0x29, 0xdc, 0xb0, 0xcf];
pub const SEL_TIMER_CAP: [u8; 4] = [0x0f, 0x63, 0x25, 0x76];
pub const SEL_PODIUM_DEADLINE: [u8; 4] = [0xab, 0x8a, 0x6e, 0xb3];
pub const SEL_PODIUM: [u8; 4] = [0x14, 0x58, 0xd4, 0xad];
pub const SEL_LAST_BUY_EPOCH: [u8; 4] = [0x6a, 0x9e, 0xa0, 0x67];
/// `podiumEpoch(uint256)` — public array getter on `TimeArena` (not `uint8`).
pub const SEL_PODIUM_EPOCH: [u8; 4] = [0x66, 0x11, 0xfd, 0x1b];
pub const SEL_CHARM_PRICE_WAD: [u8; 4] = [0xe8, 0x8f, 0x90, 0x01];
/// `effectiveCharmPriceWad()` — epoch anchor + 10%/day growth ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)).
pub const SEL_EFFECTIVE_CHARM_PRICE_WAD: [u8; 4] = [0x3d, 0x0f, 0x20, 0x1d];
pub const SEL_EPOCH_CHARM_ANCHOR_WAD: [u8; 4] = [0xd8, 0x77, 0xe8, 0x58];
pub const SEL_EPOCH_ANCHOR_TIMESTAMP: [u8; 4] = [0x21, 0x5e, 0xb1, 0xfb];
pub const SEL_DOUB: [u8; 4] = [0x8e, 0x9a, 0x61, 0x22];
pub const SEL_REFERRAL_REGISTRY: [u8; 4] = [0x4e, 0x62, 0x7e, 0x62];
pub const SEL_BUY_COOLDOWN_SEC: [u8; 4] = [0xb9, 0xa5, 0x68, 0x4f];
pub const SEL_TIMER_EXTENSION_SEC: [u8; 4] = [0x43, 0x80, 0x09, 0xaa];
pub const SEL_TIME_ARENA_BUY_ROUTER: [u8; 4] = [0x57, 0xcd, 0x7c, 0x88];
pub const SEL_REFERRAL_CRED_FLAT_WAD: [u8; 4] = [0x1f, 0x5e, 0x9f, 0x48];
/// `PodiumVaults.activePoolBalance(uint8)` ([#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)).
pub const SEL_ACTIVE_POOL_BALANCE: [u8; 4] = [0x2f, 0xd2, 0xac, 0xfb];

/// Head sale fields for Arena v2 buy hub — batched at `read_block_number` ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)).
#[derive(Debug, Clone, serde::Serialize)]
pub struct ArenaSaleHeadFields {
    /// Effective DOUB/CHARM at head (`effectiveCharmPriceWad()` — [#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)).
    pub charm_price_wad: String,
    pub epoch_charm_anchor_wad: String,
    pub epoch_anchor_timestamp_sec: String,
    pub doub: String,
    pub referral_registry: String,
    pub buy_cooldown_sec: String,
    pub timer_extension_sec: String,
    pub time_arena_buy_router: String,
    pub referral_cred_flat_wad: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChainTimerSnapshot {
    pub sale_start_sec: String,
    pub deadline_sec: String,
    pub block_timestamp_sec: String,
    pub timer_cap_sec: String,
    pub read_block_number: String,
    pub polled_at_ms: u64,
    pub last_buy_epoch: String,
    /// `podiumEpoch(cat)` for categories 0–3 at `read_block_number`.
    pub podium_epochs: [String; 4],
    pub podium_deadlines_sec: [String; 4],
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PodiumRpcRow {
    pub winners: [String; 3],
    pub values: [String; 3],
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimecurveHeadSnapshot {
    pub timer: ChainTimerSnapshot,
    pub sale_ended: bool,
    pub podium_contract: [PodiumRpcRow; 4],
    /// Head `PodiumVaults.activePoolBalance(cat)` at `read_block_number` ([#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)).
    pub active_pool_balance_doub_wad: [String; 4],
    pub sale_state: TimecurveSaleStateSnapshot,
    pub sale_head: ArenaSaleHeadFields,
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
    Ok(U256::from_be_slice(&data[data.len() - 32..]))
}

fn decode_return_address(data: &[u8]) -> Result<Address> {
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

fn addr_word_hex(a: Address) -> String {
    format!("{:#x}", a)
}

pub fn decode_podium_return(data: &[u8]) -> Result<PodiumRpcRow> {
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
        let w = Address::from_word(data[off..off + 32].try_into()?);
        *winner = addr_word_hex(w);
    }
    for (i, value) in values.iter_mut().enumerate() {
        let off = (3 + i) * 32;
        *value = u256_to_decimal_string(U256::from_be_slice(&data[off..off + 32]));
    }
    Ok(PodiumRpcRow { winners, values })
}

/// ABI-encode a category index for `podiumDeadline(uint256)` / `podiumEpoch(uint256)` array getters.
pub fn encode_u8_call(selector: [u8; 4], arg: u8) -> Bytes {
    let mut buf = Vec::with_capacity(36);
    buf.extend_from_slice(&selector);
    let mut word = [0u8; 32];
    word[31] = arg;
    buf.extend_from_slice(&word);
    Bytes::from(buf)
}

fn empty_podium_row() -> PodiumRpcRow {
    PodiumRpcRow {
        winners: std::array::from_fn(|_| addr_word_hex(Address::ZERO)),
        values: std::array::from_fn(|_| String::from("0")),
    }
}

/// Block-tagged `TimeArena.podium(category)` for ingest snapshots ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)).
pub async fn podium_at_block(
    provider: &ReqwestProvider,
    arena: Address,
    block: u64,
    category: u8,
) -> Result<PodiumRpcRow> {
    podium_at_block_id(provider, arena, BlockId::Number(block.into()), category).await
}

pub async fn podium_at_block_id(
    provider: &ReqwestProvider,
    arena: Address,
    block_id: BlockId,
    category: u8,
) -> Result<PodiumRpcRow> {
    let p_req = TransactionRequest::default()
        .to(arena)
        .input(encode_u8_call(SEL_PODIUM, category).into());
    let p_raw = provider
        .call(&p_req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("podium({category}) eth_call"))?;
    decode_podium_return(&p_raw).wrap_err_with(|| format!("decode podium({category})"))
}

pub async fn run_poll_loop(
    rpc_urls: &[String],
    time_arena: Address,
    podium_vaults: Option<Address>,
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
        match poll_any_provider(&providers, time_arena, podium_vaults).await {
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
    arena: Address,
    podium_vaults: Option<Address>,
) -> Result<TimecurveHeadSnapshot> {
    let mut last_err = None;
    for p in providers {
        match poll_once(p, arena, podium_vaults).await {
            Ok(s) => return Ok(s),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.expect("chain_timer: non-empty RPC providers"))
}

async fn eth_call_u256(
    provider: &ReqwestProvider,
    contract: Address,
    block_id: BlockId,
    input: Bytes,
    label: &str,
) -> Result<U256> {
    let req = TransactionRequest::default()
        .to(contract)
        .input(input.into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_return_u256(&raw).wrap_err_with(|| format!("decode {label}"))
}

async fn eth_call_address(
    provider: &ReqwestProvider,
    contract: Address,
    block_id: BlockId,
    selector: [u8; 4],
    label: &str,
) -> Result<Address> {
    let req = TransactionRequest::default()
        .to(contract)
        .input(Bytes::copy_from_slice(&selector).into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_return_address(&raw).wrap_err_with(|| format!("decode {label}"))
}

async fn poll_once(
    provider: &ReqwestProvider,
    arena: Address,
    podium_vaults: Option<Address>,
) -> Result<TimecurveHeadSnapshot> {
    let bn = provider.get_block_number().await?;
    let block = provider
        .get_block_by_number(bn.into(), BlockTransactionsKind::Hashes)
        .await?
        .ok_or_else(|| eyre::eyre!("chain_timer: missing block {bn}"))?;

    let block_ts = block.header.timestamp;
    let block_id = BlockId::Number(bn.into());

    let arena_start = eth_call_u256(
        provider,
        arena,
        block_id,
        Bytes::copy_from_slice(&SEL_ARENA_START),
        "arenaStart",
    )
    .await?;
    let deadline = eth_call_u256(
        provider,
        arena,
        block_id,
        Bytes::copy_from_slice(&SEL_DEADLINE),
        "deadline",
    )
    .await?;
    let cap = eth_call_u256(
        provider,
        arena,
        block_id,
        Bytes::copy_from_slice(&SEL_TIMER_CAP),
        "timerCapSec",
    )
    .await?;

    let mut podium_deadlines = std::array::from_fn(|_| String::new());
    for cat in 0u8..=3 {
        let dl = eth_call_u256(
            provider,
            arena,
            block_id,
            encode_u8_call(SEL_PODIUM_DEADLINE, cat),
            &format!("podiumDeadline({cat})"),
        )
        .await?;
        podium_deadlines[cat as usize] = u256_to_decimal_string(dl);
    }

    let last_buy_epoch = eth_call_u256(
        provider,
        arena,
        block_id,
        Bytes::copy_from_slice(&SEL_LAST_BUY_EPOCH),
        "lastBuyEpoch",
    )
    .await?;

    let mut podium_epochs = std::array::from_fn(|_| String::new());
    for cat in 0u8..=3 {
        let ep = eth_call_u256(
            provider,
            arena,
            block_id,
            encode_u8_call(SEL_PODIUM_EPOCH, cat),
            &format!("podiumEpoch({cat})"),
        )
        .await?;
        podium_epochs[cat as usize] = u256_to_decimal_string(ep);
    }

    let mut podium_rows = std::array::from_fn(|_| empty_podium_row());
    for cat in 0u8..=3 {
        podium_rows[cat as usize] = podium_at_block_id(provider, arena, block_id, cat).await?;
    }

    let mut active_pool_balance_doub_wad = std::array::from_fn(|_| String::from("0"));
    if let Some(pv) = podium_vaults.filter(|a| *a != Address::ZERO) {
        for cat in 0u8..=3 {
            let bal = eth_call_u256(
                provider,
                pv,
                block_id,
                encode_u8_call(SEL_ACTIVE_POOL_BALANCE, cat),
                &format!("activePoolBalance({cat})"),
            )
            .await?;
            active_pool_balance_doub_wad[cat as usize] = u256_to_decimal_string(bal);
        }
    }

    let polled_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let timer = ChainTimerSnapshot {
        sale_start_sec: u256_to_decimal_string(arena_start),
        deadline_sec: u256_to_decimal_string(deadline),
        block_timestamp_sec: block_ts.to_string(),
        timer_cap_sec: u256_to_decimal_string(cap),
        read_block_number: bn.to_string(),
        polled_at_ms,
        last_buy_epoch: u256_to_decimal_string(last_buy_epoch),
        podium_epochs,
        podium_deadlines_sec: podium_deadlines,
    };

    let sale_state = crate::sale_state::poll_sale_state_at_block(
        provider,
        arena,
        block_id,
        block_ts,
        bn,
        polled_at_ms,
    )
    .await?;

    let (
        charm_price_wad,
        epoch_charm_anchor_wad,
        epoch_anchor_timestamp,
        doub,
        referral_registry,
        buy_cooldown_sec,
        timer_extension_sec,
        time_arena_buy_router,
        referral_cred_flat_wad,
    ) = tokio::try_join!(
        eth_call_u256(
            provider,
            arena,
            block_id,
            Bytes::copy_from_slice(&SEL_EFFECTIVE_CHARM_PRICE_WAD),
            "effectiveCharmPriceWad",
        ),
        eth_call_u256(
            provider,
            arena,
            block_id,
            Bytes::copy_from_slice(&SEL_EPOCH_CHARM_ANCHOR_WAD),
            "epochCharmAnchorWad",
        ),
        eth_call_u256(
            provider,
            arena,
            block_id,
            Bytes::copy_from_slice(&SEL_EPOCH_ANCHOR_TIMESTAMP),
            "epochAnchorTimestamp",
        ),
        eth_call_address(provider, arena, block_id, SEL_DOUB, "doub"),
        eth_call_address(
            provider,
            arena,
            block_id,
            SEL_REFERRAL_REGISTRY,
            "referralRegistry",
        ),
        eth_call_u256(
            provider,
            arena,
            block_id,
            Bytes::copy_from_slice(&SEL_BUY_COOLDOWN_SEC),
            "buyCooldownSec",
        ),
        eth_call_u256(
            provider,
            arena,
            block_id,
            Bytes::copy_from_slice(&SEL_TIMER_EXTENSION_SEC),
            "timerExtensionSec",
        ),
        eth_call_address(
            provider,
            arena,
            block_id,
            SEL_TIME_ARENA_BUY_ROUTER,
            "timeArenaBuyRouter",
        ),
        eth_call_u256(
            provider,
            arena,
            block_id,
            Bytes::copy_from_slice(&SEL_REFERRAL_CRED_FLAT_WAD),
            "REFERRAL_CRED_FLAT_WAD",
        ),
    )?;

    let sale_head = ArenaSaleHeadFields {
        charm_price_wad: u256_to_decimal_string(charm_price_wad),
        epoch_charm_anchor_wad: u256_to_decimal_string(epoch_charm_anchor_wad),
        epoch_anchor_timestamp_sec: u256_to_decimal_string(epoch_anchor_timestamp),
        doub: addr_word_hex(doub),
        referral_registry: addr_word_hex(referral_registry),
        buy_cooldown_sec: u256_to_decimal_string(buy_cooldown_sec),
        timer_extension_sec: u256_to_decimal_string(timer_extension_sec),
        time_arena_buy_router: addr_word_hex(time_arena_buy_router),
        referral_cred_flat_wad: u256_to_decimal_string(referral_cred_flat_wad),
    };

    Ok(TimecurveHeadSnapshot {
        timer,
        sale_ended: false,
        podium_contract: podium_rows,
        active_pool_balance_doub_wad,
        sale_state,
        sale_head,
    })
}
