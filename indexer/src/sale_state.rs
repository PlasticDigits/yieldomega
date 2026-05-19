// SPDX-License-Identifier: AGPL-3.0-or-later

//! Head RPC snapshot for `GET /v1/timecurve/sale-state` — same block tag as chain-timer poll ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)).

use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::{Provider, ReqwestProvider};
use alloy_rpc_types::{BlockId, TransactionRequest};
use eyre::{Result, WrapErr};

/// One `FeeRouter.sinks(i)` row for `GET /v1/timecurve/sale-state` (schema ≥ 1.24.0).
#[derive(Debug, Clone, serde::Serialize)]
pub struct FeeRouterSinkSnapshot {
    pub destination: String,
    pub weight_bps: u16,
}

/// JSON body for `GET /v1/timecurve/sale-state` (schema ≥ 1.24.0).
#[derive(Debug, Clone, serde::Serialize)]
pub struct TimecurveSaleStateSnapshot {
    pub read_block_number: String,
    pub block_timestamp_sec: String,
    pub polled_at_ms: u64,
    pub sale_start_sec: String,
    pub deadline_sec: String,
    pub ended: bool,
    pub timer_extension_sec: String,
    pub timer_cap_sec: String,
    pub buy_cooldown_sec: String,
    pub current_min_buy_amount: String,
    pub current_max_buy_amount: String,
    pub current_charm_bounds_min_wad: String,
    pub current_charm_bounds_max_wad: String,
    pub current_price_per_charm_wad: String,
    pub charm_price: String,
    pub total_raised: String,
    pub total_charm_weight: String,
    pub total_tokens_for_sale: String,
    pub initial_min_buy: String,
    pub growth_rate_wad: String,
    pub accepted_asset: String,
    pub referral_registry: String,
    pub launched_token: String,
    pub buy_fee_routing_enabled: bool,
    pub charm_redemption_enabled: bool,
    pub reserve_podium_payouts_enabled: bool,
    pub time_curve_buy_router: String,
    pub podium_pool: String,
    pub doub_presale_vesting: String,
    pub referral_each_bps: String,
    pub presale_charm_weight_bps: String,
    pub warbow_pending_flag_owner: String,
    pub warbow_pending_flag_plant_at: String,
    pub warbow_flag_claim_bp: String,
    pub warbow_flag_silence_sec: String,
    pub initial_timer_sec: String,
    pub prizes_distributed: bool,
    pub fee_router: String,
    pub owner: String,
    pub linear_charm_base_price_wad: String,
    pub linear_charm_daily_increment_wad: String,
    /// `FeeRouter.sinks(0..5)` at `read_block_number`.
    pub fee_router_sinks: [FeeRouterSinkSnapshot; 5],
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

fn decode_return_address(data: &[u8]) -> Result<Address> {
    if data.len() < 32 {
        return Err(eyre::eyre!(
            "eth_call return too short for address: {} bytes",
            data.len()
        ));
    }
    let slice = &data[data.len() - 32..];
    Ok(Address::from_word(
        slice
            .try_into()
            .map_err(|_| eyre::eyre!("address word"))?,
    ))
}

fn addr_word_hex(a: Address) -> String {
    format!("{:#x}", a)
}

fn encode_u256_arg_calldata(selector: [u8; 4], arg: U256) -> Vec<u8> {
    let mut input = Vec::with_capacity(36);
    input.extend_from_slice(&selector);
    input.extend_from_slice(&arg.to_be_bytes::<32>());
    input
}

fn decode_sink_return(data: &[u8]) -> Result<(Address, u16)> {
    let destination = decode_return_address(data)?;
    let weight_bps = if data.len() >= 64 {
        let w = decode_return_u256(&data[32..64])?;
        u16::try_from(w.to::<u64>()).unwrap_or(0)
    } else {
        0
    };
    Ok((destination, weight_bps))
}

async fn eth_call_sink(
    provider: &ReqwestProvider,
    fee_router: Address,
    block_id: BlockId,
    index: u8,
    label: &str,
) -> Result<(Address, u16)> {
    const SEL_SINKS: [u8; 4] = [0x97, 0x76, 0x4a, 0x55];
    let input = encode_u256_arg_calldata(SEL_SINKS, U256::from(index));
    let req = TransactionRequest::default()
        .to(fee_router)
        .input(Bytes::from(input).into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_sink_return(&raw).wrap_err_with(|| format!("decode {label}"))
}

async fn eth_call_u256(
    provider: &ReqwestProvider,
    tc: Address,
    block_id: BlockId,
    selector: [u8; 4],
    label: &str,
) -> Result<U256> {
    let req = TransactionRequest::default()
        .to(tc)
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
    tc: Address,
    block_id: BlockId,
    selector: [u8; 4],
    label: &str,
) -> Result<bool> {
    let req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&selector).into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_return_bool(&raw).wrap_err_with(|| format!("decode {label}"))
}

async fn eth_call_address(
    provider: &ReqwestProvider,
    tc: Address,
    block_id: BlockId,
    selector: [u8; 4],
    label: &str,
) -> Result<Address> {
    let req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&selector).into());
    let raw = provider
        .call(&req)
        .block(block_id)
        .await
        .wrap_err_with(|| format!("{label} eth_call"))?;
    decode_return_address(&raw).wrap_err_with(|| format!("decode {label}"))
}

/// Poll all sale-state views at `block_id` (shared head with chain-timer).
pub async fn poll_sale_state_at_block(
    provider: &ReqwestProvider,
    tc: Address,
    block_id: BlockId,
    block_ts: u64,
    read_block_number: u64,
    polled_at_ms: u64,
) -> Result<TimecurveSaleStateSnapshot> {
    const SEL_CURRENT_MIN_BUY: [u8; 4] = [0x7d, 0x1a, 0x49, 0xdd];
    const SEL_CURRENT_MAX_BUY: [u8; 4] = [0x4e, 0xcc, 0xdd, 0x7b];
    const SEL_CHARM_BOUNDS: [u8; 4] = [0x7a, 0x77, 0x96, 0x81];
    const SEL_PRICE_PER_CHARM: [u8; 4] = [0x9e, 0x6e, 0x0e, 0xbb];
    const SEL_CHARM_PRICE: [u8; 4] = [0xfc, 0xf9, 0xfa, 0x14];
    const SEL_TOTAL_RAISED: [u8; 4] = [0xc5, 0xc4, 0x74, 0x4c];
    const SEL_TOTAL_CHARM_WEIGHT: [u8; 4] = [0x92, 0x88, 0x2c, 0x36];
    const SEL_TOTAL_TOKENS: [u8; 4] = [0x60, 0x21, 0x9c, 0x7b];
    const SEL_INITIAL_MIN: [u8; 4] = [0x6e, 0x00, 0xd8, 0xe5];
    const SEL_GROWTH_RATE: [u8; 4] = [0xa4, 0x91, 0xfa, 0x5d];
    const SEL_TIMER_EXT: [u8; 4] = [0x43, 0x80, 0x09, 0xaa];
    const SEL_BUY_COOLDOWN: [u8; 4] = [0xb9, 0xa5, 0x68, 0x4f];
    const SEL_REFERRAL_EACH: [u8; 4] = [0xd5, 0xe6, 0x8d, 0x7c];
    const SEL_PRESALE_CHARM: [u8; 4] = [0xee, 0xa6, 0x08, 0x29];
    const SEL_WARBOW_FLAG_CLAIM: [u8; 4] = [0xf0, 0xd7, 0x7b, 0x70];
    const SEL_WARBOW_FLAG_SILENCE: [u8; 4] = [0xfe, 0xbc, 0x02, 0x0f];
    const SEL_WARBOW_FLAG_PLANT_AT: [u8; 4] = [0x18, 0xf0, 0x57, 0x4d];
    const SEL_INITIAL_TIMER: [u8; 4] = [0x12, 0x40, 0x7d, 0x45];
    const SEL_PRIZES_DISTRIBUTED: [u8; 4] = [0x27, 0x77, 0x72, 0x4b];
    const SEL_FEE_ROUTER: [u8; 4] = [0xf2, 0x9e, 0xbf, 0x61];
    const SEL_OWNER: [u8; 4] = [0x8d, 0xa5, 0xcb, 0x5b];
    const SEL_BASE_PRICE_WAD: [u8; 4] = [0x9a, 0x72, 0x2f, 0xfb];
    const SEL_DAILY_INCREMENT_WAD: [u8; 4] = [0x03, 0xe4, 0x83, 0xd8];

    let sale_start = eth_call_u256(
        provider,
        tc,
        block_id,
        super::chain_timer::SEL_SALE_START,
        "saleStart",
    )
    .await?;
    let deadline = eth_call_u256(
        provider,
        tc,
        block_id,
        super::chain_timer::SEL_DEADLINE,
        "deadline",
    )
    .await?;
    let timer_cap = eth_call_u256(
        provider,
        tc,
        block_id,
        super::chain_timer::SEL_TIMER_CAP,
        "timerCapSec",
    )
    .await?;
    let ended = eth_call_bool(
        provider,
        tc,
        block_id,
        super::chain_timer::SEL_ENDED,
        "ended",
    )
    .await?;

    let bounds_req = TransactionRequest::default()
        .to(tc)
        .input(Bytes::copy_from_slice(&SEL_CHARM_BOUNDS).into());
    let bounds_raw = provider
        .call(&bounds_req)
        .block(block_id)
        .await
        .wrap_err("currentCharmBoundsWad eth_call")?;
    let bounds_min = if bounds_raw.len() >= 32 {
        decode_return_u256(&bounds_raw[0..32]).wrap_err("decode bounds min")?
    } else {
        decode_return_u256(&bounds_raw).wrap_err("decode bounds min")?
    };
    let bounds_max = if bounds_raw.len() >= 64 {
        decode_return_u256(&bounds_raw[32..64]).wrap_err("decode bounds max")?
    } else {
        bounds_min
    };

    let (
        current_min,
        current_max,
        price_per_charm,
        total_raised,
        total_charm_weight,
        total_tokens,
        initial_min,
        growth_rate,
        timer_ext,
        buy_cooldown,
        referral_each,
        presale_charm_bps,
        warbow_flag_claim,
        warbow_flag_silence,
        warbow_flag_plant_at,
    ) = tokio::try_join!(
        eth_call_u256(provider, tc, block_id, SEL_CURRENT_MIN_BUY, "currentMinBuyAmount"),
        eth_call_u256(provider, tc, block_id, SEL_CURRENT_MAX_BUY, "currentMaxBuyAmount"),
        eth_call_u256(provider, tc, block_id, SEL_PRICE_PER_CHARM, "currentPricePerCharmWad"),
        eth_call_u256(provider, tc, block_id, SEL_TOTAL_RAISED, "totalRaised"),
        eth_call_u256(provider, tc, block_id, SEL_TOTAL_CHARM_WEIGHT, "totalCharmWeight"),
        eth_call_u256(provider, tc, block_id, SEL_TOTAL_TOKENS, "totalTokensForSale"),
        eth_call_u256(provider, tc, block_id, SEL_INITIAL_MIN, "initialMinBuy"),
        eth_call_u256(provider, tc, block_id, SEL_GROWTH_RATE, "growthRateWad"),
        eth_call_u256(provider, tc, block_id, SEL_TIMER_EXT, "timerExtensionSec"),
        eth_call_u256(provider, tc, block_id, SEL_BUY_COOLDOWN, "buyCooldownSec"),
        eth_call_u256(provider, tc, block_id, SEL_REFERRAL_EACH, "REFERRAL_EACH_BPS"),
        eth_call_u256(provider, tc, block_id, SEL_PRESALE_CHARM, "PRESALE_CHARM_WEIGHT_BPS"),
        eth_call_u256(provider, tc, block_id, SEL_WARBOW_FLAG_CLAIM, "WARBOW_FLAG_CLAIM_BP"),
        eth_call_u256(provider, tc, block_id, SEL_WARBOW_FLAG_SILENCE, "WARBOW_FLAG_SILENCE_SEC"),
        eth_call_u256(provider, tc, block_id, SEL_WARBOW_FLAG_PLANT_AT, "warbowPendingFlagPlantAt"),
    )?;

    let (
        charm_price,
        accepted_asset,
        referral_registry,
        launched_token,
        buy_fee_routing,
        charm_redemption,
        reserve_podium,
        buy_router,
        podium_pool,
        doub_vesting,
        warbow_flag_owner,
    ) = tokio::try_join!(
        eth_call_address(provider, tc, block_id, SEL_CHARM_PRICE, "charmPrice"),
        eth_call_address(provider, tc, block_id, [0xd9, 0x06, 0xb4, 0xd1], "acceptedAsset"),
        eth_call_address(provider, tc, block_id, [0x4e, 0x62, 0x7e, 0x62], "referralRegistry"),
        eth_call_address(provider, tc, block_id, [0xfd, 0x43, 0x51, 0x25], "launchedToken"),
        eth_call_bool(provider, tc, block_id, [0xcc, 0x11, 0x83, 0x12], "buyFeeRoutingEnabled"),
        eth_call_bool(provider, tc, block_id, [0x2a, 0x95, 0x94, 0x5d], "charmRedemptionEnabled"),
        eth_call_bool(
            provider,
            tc,
            block_id,
            [0x62, 0x39, 0xae, 0x4b],
            "reservePodiumPayoutsEnabled"
        ),
        eth_call_address(provider, tc, block_id, [0xbb, 0x70, 0x92, 0xb7], "timeCurveBuyRouter"),
        eth_call_address(provider, tc, block_id, [0x58, 0x15, 0x46, 0xb1], "podiumPool"),
        eth_call_address(provider, tc, block_id, [0x11, 0xc1, 0x42, 0xb2], "doubPresaleVesting"),
        eth_call_address(
            provider,
            tc,
            block_id,
            [0x44, 0x23, 0x33, 0x8e],
            "warbowPendingFlagOwner"
        ),
    )?;

    let (
        initial_timer,
        prizes_distributed,
        fee_router,
        owner,
        linear_base,
        linear_daily,
    ) = tokio::try_join!(
        eth_call_u256(provider, tc, block_id, SEL_INITIAL_TIMER, "initialTimerSec"),
        eth_call_bool(provider, tc, block_id, SEL_PRIZES_DISTRIBUTED, "prizesDistributed"),
        eth_call_address(provider, tc, block_id, SEL_FEE_ROUTER, "feeRouter"),
        eth_call_address(provider, tc, block_id, SEL_OWNER, "owner"),
        eth_call_u256(
            provider,
            charm_price,
            block_id,
            SEL_BASE_PRICE_WAD,
            "basePriceWad"
        ),
        eth_call_u256(
            provider,
            charm_price,
            block_id,
            SEL_DAILY_INCREMENT_WAD,
            "dailyIncrementWad"
        ),
    )?;

    let mut fee_router_sinks =
        std::array::from_fn(|_| FeeRouterSinkSnapshot {
            destination: addr_word_hex(Address::ZERO),
            weight_bps: 0,
        });
    if fee_router != Address::ZERO {
        let (s0, s1, s2, s3, s4) = tokio::try_join!(
            eth_call_sink(provider, fee_router, block_id, 0, "sinks(0)"),
            eth_call_sink(provider, fee_router, block_id, 1, "sinks(1)"),
            eth_call_sink(provider, fee_router, block_id, 2, "sinks(2)"),
            eth_call_sink(provider, fee_router, block_id, 3, "sinks(3)"),
            eth_call_sink(provider, fee_router, block_id, 4, "sinks(4)"),
        )?;
        for (i, (dest, bps)) in [s0, s1, s2, s3, s4].into_iter().enumerate() {
            fee_router_sinks[i] = FeeRouterSinkSnapshot {
                destination: addr_word_hex(dest),
                weight_bps: bps,
            };
        }
    }

    Ok(TimecurveSaleStateSnapshot {
        read_block_number: read_block_number.to_string(),
        block_timestamp_sec: block_ts.to_string(),
        polled_at_ms,
        sale_start_sec: u256_to_decimal_string(sale_start),
        deadline_sec: u256_to_decimal_string(deadline),
        ended,
        timer_extension_sec: u256_to_decimal_string(timer_ext),
        timer_cap_sec: u256_to_decimal_string(timer_cap),
        buy_cooldown_sec: u256_to_decimal_string(buy_cooldown),
        current_min_buy_amount: u256_to_decimal_string(current_min),
        current_max_buy_amount: u256_to_decimal_string(current_max),
        current_charm_bounds_min_wad: u256_to_decimal_string(bounds_min),
        current_charm_bounds_max_wad: u256_to_decimal_string(bounds_max),
        current_price_per_charm_wad: u256_to_decimal_string(price_per_charm),
        charm_price: addr_word_hex(charm_price),
        total_raised: u256_to_decimal_string(total_raised),
        total_charm_weight: u256_to_decimal_string(total_charm_weight),
        total_tokens_for_sale: u256_to_decimal_string(total_tokens),
        initial_min_buy: u256_to_decimal_string(initial_min),
        growth_rate_wad: u256_to_decimal_string(growth_rate),
        accepted_asset: addr_word_hex(accepted_asset),
        referral_registry: addr_word_hex(referral_registry),
        launched_token: addr_word_hex(launched_token),
        buy_fee_routing_enabled: buy_fee_routing,
        charm_redemption_enabled: charm_redemption,
        reserve_podium_payouts_enabled: reserve_podium,
        time_curve_buy_router: addr_word_hex(buy_router),
        podium_pool: addr_word_hex(podium_pool),
        doub_presale_vesting: addr_word_hex(doub_vesting),
        referral_each_bps: u256_to_decimal_string(referral_each),
        presale_charm_weight_bps: u256_to_decimal_string(presale_charm_bps),
        warbow_pending_flag_owner: addr_word_hex(warbow_flag_owner),
        warbow_pending_flag_plant_at: u256_to_decimal_string(warbow_flag_plant_at),
        warbow_flag_claim_bp: u256_to_decimal_string(warbow_flag_claim),
        warbow_flag_silence_sec: u256_to_decimal_string(warbow_flag_silence),
        initial_timer_sec: u256_to_decimal_string(initial_timer),
        prizes_distributed,
        fee_router: addr_word_hex(fee_router),
        owner: addr_word_hex(owner),
        linear_charm_base_price_wad: u256_to_decimal_string(linear_base),
        linear_charm_daily_increment_wad: u256_to_decimal_string(linear_daily),
        fee_router_sinks,
    })
}
