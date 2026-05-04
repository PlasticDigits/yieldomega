// SPDX-License-Identifier: AGPL-3.0-or-later

//! ABI event decoding via `sol!` definitions mirroring onchain contracts.

use alloy_primitives::{Address, Log, B256, U256};
use alloy_rpc_types::Log as RpcLog;
use alloy_sol_types::SolEvent;

mod contracts {
    use alloy_sol_types::sol;

    sol! {
        /// Legacy event name (same payload as `CharmsRedeemed`); keep for historical logs.
        contract TimeCurveEventsLegacy {
            event AllocationClaimed(address indexed buyer, uint256 tokenAmount);
        }
    }

    sol! {
        /// Pre–v1-category `Buy` payload (7 data fields after indexed buyer). Topic differs from current `Buy`.
        contract TimeCurveBuyLegacy {
            event Buy(
                address indexed buyer,
                uint256 charmWad,
                uint256 amount,
                uint256 pricePerCharmWad,
                uint256 newDeadline,
                uint256 totalRaisedAfter,
                uint256 buyIndex
            );
        }
    }

    sol! {
        /// Activity-era `Buy` (pre–WarBow); distinct topic from current `Buy`.
        contract TimeCurveBuyV2Activity {
            event Buy(
                address indexed buyer,
                uint256 charmWad,
                uint256 amount,
                uint256 pricePerCharmWad,
                uint256 newDeadline,
                uint256 totalRaisedAfter,
                uint256 buyIndex,
                uint256 actualSecondsAdded,
                bool activityAttack,
                uint256 activityPointsTakenFromLeader,
                uint256 buyerActivityPointsAfter,
                uint256 buyerTotalEffectiveTimerSecAdded,
                uint256 buyerActiveDefendedStreak,
                uint256 buyerBestDefendedStreak
            );
        }
    }

    sol! {
        contract TimeCurveEvents {
            event SaleStarted(uint256 startTimestamp, uint256 initialDeadline, uint256 totalTokensForSale);
            event Buy(
                address indexed buyer,
                uint256 charmWad,
                uint256 amount,
                uint256 pricePerCharmWad,
                uint256 newDeadline,
                uint256 totalRaisedAfter,
                uint256 buyIndex,
                uint256 actualSecondsAdded,
                bool timerHardReset,
                uint256 battlePointsAfter,
                uint256 bpBaseBuy,
                uint256 bpTimerResetBonus,
                uint256 bpClutchBonus,
                uint256 bpStreakBreakBonus,
                uint256 bpAmbushBonus,
                uint256 bpFlagPenalty,
                bool flagPlanted,
                uint256 buyerTotalEffectiveTimerSecAdded,
                uint256 buyerActiveDefendedStreak,
                uint256 buyerBestDefendedStreak
            );
            event SaleEnded(uint256 endTimestamp, uint256 totalRaised, uint256 totalBuys);
            event CharmsRedeemed(address indexed buyer, uint256 tokenAmount);
            event PrizesDistributed();
            event ReferralApplied(
                address indexed buyer,
                address indexed referrer,
                bytes32 indexed codeHash,
                uint256 referrerCharmAdded,
                uint256 refereeCharmAdded,
                uint256 grossAmountRoutedToFeeRouter
            );
            event WarBowSteal(
                address indexed attacker,
                address indexed victim,
                uint256 amountBp,
                uint256 burnPaidWad,
                bool bypassedVictimDailyLimit,
                uint256 victimBpAfter,
                uint256 attackerBpAfter
            );
            event WarBowRevenge(
                address indexed avenger,
                address indexed stealer,
                uint256 amountBp,
                uint256 burnPaidWad
            );
            event WarBowGuardActivated(
                address indexed player,
                uint256 guardUntilTs,
                uint256 burnPaidWad
            );
            event WarBowFlagClaimed(
                address indexed player,
                uint256 bonusBp,
                uint256 battlePointsAfter
            );
            event WarBowFlagPenalized(
                address indexed formerHolder,
                uint256 penaltyBp,
                address indexed triggeringBuyer,
                uint256 battlePointsAfter
            );
            event WarBowCl8yBurned(address indexed payer, uint8 indexed reason, uint256 amountWad);
            event WarBowDefendedStreakContinued(
                address indexed wallet,
                uint256 activeStreak,
                uint256 bestStreak
            );
            event WarBowDefendedStreakBroken(
                address indexed formerHolder,
                address indexed interrupter,
                uint256 brokenActiveLength
            );
            event WarBowDefendedStreakWindowCleared(address indexed clearedWallet);
            event BuyFeeRoutingEnabled(bool enabled);
            event CharmRedemptionEnabled(bool enabled);
            event ReservePodiumPayoutsEnabled(bool enabled);
            event TimeCurveBuyRouterSet(address indexed router);
            event DoubPresaleVestingSet(address indexed vesting);
        }
    }

    sol! {
        /// Companion router observability (`TimeCurve.buyFor` entry — GitLab #65 / #67).
        contract TimeCurveBuyRouterEvents {
            event BuyViaKumbaya(address indexed buyer, uint256 charmWad, uint256 grossCl8y, uint8 payKind);
            event Cl8ySurplusToProtocol(uint256 amount);
        }
    }

    sol! {
        contract ReferralRegistryEvents {
            event ReferralCodeRegistered(address indexed owner, bytes32 indexed codeHash, string normalizedCode);
        }
    }

    sol! {
        contract PodiumPoolEvents {
            event PodiumPaid(address indexed winner, address indexed token, uint256 amount, uint8 category, uint8 placement);
            event PodiumResidualForwarded(address indexed token, address indexed recipient, uint256 amount, uint8 category);
            event PrizePusherSet(address indexed pusher);
        }
    }

    sol! {
        contract RabbitTreasuryEvents {
            event BurrowEpochOpened(uint256 indexed epochId, uint256 startTimestamp, uint256 endTimestamp);
            event BurrowHealthEpochFinalized(
                uint256 indexed epochId,
                uint256 finalizedAt,
                uint256 reserveRatioWad,
                uint256 doubTotalSupply,
                uint256 repricingFactorWad,
                uint256 backingPerDoubloonWad,
                uint256 internalStateEWad
            );
            event BurrowEpochReserveSnapshot(uint256 indexed epochId, address indexed reserveAsset, uint256 balance);
            event BurrowReserveBalanceUpdated(
                address indexed reserveAsset,
                uint256 balanceAfter,
                int256 delta,
                uint8 reasonCode
            );
            event BurrowDeposited(
                address indexed user,
                address indexed reserveAsset,
                uint256 amount,
                uint256 doubOut,
                uint256 indexed epochId,
                uint256 factionId
            );
            event BurrowWithdrawn(
                address indexed user,
                address indexed reserveAsset,
                uint256 amount,
                uint256 doubIn,
                uint256 indexed epochId,
                uint256 factionId
            );
            event BurrowFeeAccrued(
                address indexed asset,
                uint256 amount,
                uint256 cumulativeInAsset,
                uint256 indexed epochId
            );
            event BurrowReserveBuckets(
                uint256 indexed epochId,
                uint256 redeemableBacking,
                uint256 protocolOwnedBacking,
                uint256 totalBacking
            );
            event BurrowProtocolRevenueSplit(
                uint256 indexed epochId,
                uint256 grossAmount,
                uint256 toProtocolBucket,
                uint256 burnedAmount
            );
            event BurrowWithdrawalFeeAccrued(
                address indexed asset,
                uint256 feeAmount,
                uint256 cumulativeWithdrawFees
            );
            event BurrowRepricingApplied(
                uint256 indexed epochId,
                uint256 repricingFactorWad,
                uint256 priorInternalPriceWad,
                uint256 newInternalPriceWad
            );
            event ParamsUpdated(address indexed actor, string paramName, uint256 oldValue, uint256 newValue);
        }
    }

    sol! {
        contract LeprechaunEvents {
            event SeriesCreated(uint256 indexed seriesId, uint256 maxSupply);
            event Minted(uint256 indexed tokenId, uint256 indexed seriesId, address indexed to);
        }
    }

    sol! {
        contract FeeRouterEvents {
            event SinksUpdated(
                address indexed actor,
                address[5] oldDestinations,
                uint16[5] oldWeights,
                address[5] newDestinations,
                uint16[5] newWeights
            );
            event FeesDistributed(address indexed token, uint256 amount, uint256[5] shares);
        }
    }

    sol! {
        contract DoubPresaleVestingEvents {
            event VestingStarted(uint256 startTimestamp, uint256 durationSec, uint256 totalAllocated_);
            event Claimed(address indexed beneficiary, uint256 amount);
            event ClaimsEnabled(bool enabled);
        }
    }

    sol! {
        contract FeeSinkEvents {
            event Withdrawn(address indexed token, address indexed to, uint256 amount, address indexed actor);
        }
    }
}

use contracts::{
    DoubPresaleVestingEvents, FeeRouterEvents, FeeSinkEvents, LeprechaunEvents, PodiumPoolEvents,
    RabbitTreasuryEvents, ReferralRegistryEvents, TimeCurveBuyLegacy, TimeCurveBuyRouterEvents,
    TimeCurveBuyV2Activity, TimeCurveEvents, TimeCurveEventsLegacy,
};

/// Fully decoded log plus block metadata for persistence.
#[derive(Debug, Clone)]
pub struct DecodedLog {
    pub block_number: u64,
    pub block_hash: B256,
    pub tx_hash: B256,
    pub log_index: u64,
    /// Block time (Unix seconds) when present on the RPC log; used for UTC-day WarBow limits.
    pub block_timestamp: Option<u64>,
    pub contract: Address,
    pub event: DecodedEvent,
}

#[derive(Debug, Clone)]
pub enum DecodedEvent {
    TimeCurveSaleStarted {
        start_timestamp: U256,
        initial_deadline: U256,
        total_tokens_for_sale: U256,
    },
    TimeCurveBuy {
        buyer: Address,
        charm_wad: U256,
        amount: U256,
        price_per_charm_wad: U256,
        new_deadline: U256,
        total_raised_after: U256,
        buy_index: U256,
        actual_seconds_added: U256,
        timer_hard_reset: bool,
        battle_points_after: U256,
        bp_base_buy: U256,
        bp_timer_reset_bonus: U256,
        bp_clutch_bonus: U256,
        bp_streak_break_bonus: U256,
        bp_ambush_bonus: U256,
        bp_flag_penalty: U256,
        flag_planted: bool,
        buyer_total_effective_timer_sec: U256,
        buyer_active_defended_streak: U256,
        buyer_best_defended_streak: U256,
    },
    /// Emitted by `TimeCurveBuyRouter` after `TimeCurve.buyFor` in the same tx (GitLab #67).
    TimeCurveBuyRouterBuyViaKumbaya {
        buyer: Address,
        charm_wad: U256,
        gross_cl8y: U256,
        pay_kind: u8,
    },
    TimeCurveBuyRouterCl8ySurplus { amount: U256 },
    TimeCurveSaleEnded {
        end_timestamp: U256,
        total_raised: U256,
        total_buys: U256,
    },
    TimeCurveCharmsRedeemed {
        buyer: Address,
        token_amount: U256,
    },
    TimeCurvePrizesDistributed,
    TimeCurveReferralApplied {
        buyer: Address,
        referrer: Address,
        code_hash: B256,
        referrer_amount: U256,
        referee_amount: U256,
        amount_to_fee_router: U256,
    },
    TimeCurveWarBowSteal {
        attacker: Address,
        victim: Address,
        amount_bp: U256,
        burn_paid_wad: U256,
        bypassed_victim_daily_limit: bool,
        victim_bp_after: U256,
        attacker_bp_after: U256,
    },
    TimeCurveWarBowRevenge {
        avenger: Address,
        stealer: Address,
        amount_bp: U256,
        burn_paid_wad: U256,
    },
    TimeCurveWarBowGuardActivated {
        player: Address,
        guard_until_ts: U256,
        burn_paid_wad: U256,
    },
    TimeCurveWarBowFlagClaimed {
        player: Address,
        bonus_bp: U256,
        battle_points_after: U256,
    },
    TimeCurveWarBowFlagPenalized {
        former_holder: Address,
        penalty_bp: U256,
        triggering_buyer: Address,
        battle_points_after: U256,
    },
    TimeCurveWarBowCl8yBurned {
        payer: Address,
        reason: u8,
        amount_wad: U256,
    },
    TimeCurveWarBowDefendedStreakContinued {
        wallet: Address,
        active_streak: U256,
        best_streak: U256,
    },
    TimeCurveWarBowDefendedStreakBroken {
        former_holder: Address,
        interrupter: Address,
        broken_active_length: U256,
    },
    TimeCurveWarBowDefendedStreakWindowCleared {
        cleared_wallet: Address,
    },
    TimeCurveBuyFeeRoutingEnabled { enabled: bool },
    TimeCurveCharmRedemptionEnabled { enabled: bool },
    TimeCurveReservePodiumPayoutsEnabled { enabled: bool },
    TimeCurveBuyRouterSet { router: Address },
    TimeCurveDoubPresaleVestingSet { vesting: Address },
    ReferralCodeRegistered {
        owner: Address,
        code_hash: B256,
        normalized_code: String,
    },
    PodiumPoolPaid {
        winner: Address,
        token: Address,
        amount: U256,
        category: u8,
        placement: u8,
    },
    PodiumPoolResidualForwarded {
        token: Address,
        recipient: Address,
        amount: U256,
        category: u8,
    },
    PodiumPoolPrizePusherSet { pusher: Address },
    RabbitEpochOpened {
        epoch_id: U256,
        start_timestamp: U256,
        end_timestamp: U256,
    },
    RabbitHealthEpochFinalized {
        epoch_id: U256,
        finalized_at: U256,
        reserve_ratio_wad: U256,
        doub_total_supply: U256,
        repricing_factor_wad: U256,
        backing_per_doubloon_wad: U256,
        internal_state_e_wad: U256,
    },
    RabbitEpochReserveSnapshot {
        epoch_id: U256,
        reserve_asset: Address,
        balance: U256,
    },
    RabbitReserveBalanceUpdated {
        reserve_asset: Address,
        balance_after: U256,
        delta: String,
        reason_code: u8,
    },
    RabbitDeposit {
        user: Address,
        reserve_asset: Address,
        amount: U256,
        doub_out: U256,
        epoch_id: U256,
        faction_id: U256,
    },
    RabbitWithdrawal {
        user: Address,
        reserve_asset: Address,
        amount: U256,
        doub_in: U256,
        epoch_id: U256,
        faction_id: U256,
    },
    RabbitFeeAccrued {
        asset: Address,
        amount: U256,
        cumulative_in_asset: U256,
        epoch_id: U256,
    },
    RabbitBurrowReserveBuckets {
        epoch_id: U256,
        redeemable_backing: U256,
        protocol_owned_backing: U256,
        total_backing: U256,
    },
    RabbitProtocolRevenueSplit {
        epoch_id: U256,
        gross_amount: U256,
        to_protocol_bucket: U256,
        burned_amount: U256,
    },
    RabbitWithdrawalFeeAccrued {
        asset: Address,
        fee_amount: U256,
        cumulative_withdraw_fees: U256,
    },
    RabbitRepricingApplied {
        epoch_id: U256,
        repricing_factor_wad: U256,
        prior_internal_price_wad: U256,
        new_internal_price_wad: U256,
    },
    RabbitParamsUpdated {
        actor: Address,
        param_name: String,
        old_value: U256,
        new_value: U256,
    },
    NftSeriesCreated {
        series_id: U256,
        max_supply: U256,
    },
    NftMinted {
        token_id: U256,
        series_id: U256,
        to: Address,
    },
    FeeRouterSinksUpdated {
        actor: Address,
        old_destinations: [Address; 5],
        old_weights: [u16; 5],
        new_destinations: [Address; 5],
        new_weights: [u16; 5],
    },
    FeeRouterFeesDistributed {
        token: Address,
        amount: U256,
        shares: [U256; 5],
    },
    DoubVestingStarted {
        start_timestamp: U256,
        duration_sec: U256,
        total_allocated: U256,
    },
    DoubVestingClaimed {
        beneficiary: Address,
        amount: U256,
    },
    DoubVestingClaimsEnabled { enabled: bool },
    FeeSinkWithdrawn {
        token: Address,
        recipient: Address,
        amount: U256,
        actor: Address,
    },
    Unknown {
        #[allow(dead_code)]
        topic0: B256,
    },
}

/// Decode a single RPC log. Missing metadata yields `None` (caller should skip).
pub fn decode_rpc_log(rlog: &RpcLog) -> Option<DecodedLog> {
    let block_number = rlog.block_number?;
    let block_hash = rlog.block_hash?;
    let tx_hash = rlog.transaction_hash?;
    let log_index = rlog.log_index?;

    let inner = &rlog.inner;
    let topic0 = *inner.topics().first()?;

    let event = decode_primitive_log(inner, topic0);

    Some(DecodedLog {
        block_number,
        block_hash,
        tx_hash,
        log_index,
        block_timestamp: rlog.block_timestamp,
        contract: inner.address,
        event,
    })
}

fn decode_primitive_log(log: &Log, topic0: B256) -> DecodedEvent {
    if topic0 == TimeCurveEvents::SaleStarted::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::SaleStarted::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveSaleStarted {
                start_timestamp: e.startTimestamp,
                initial_deadline: e.initialDeadline,
                total_tokens_for_sale: e.totalTokensForSale,
            };
        }
    }
    if topic0 == TimeCurveEvents::Buy::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::Buy::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuy {
                buyer: e.buyer,
                charm_wad: e.charmWad,
                amount: e.amount,
                price_per_charm_wad: e.pricePerCharmWad,
                new_deadline: e.newDeadline,
                total_raised_after: e.totalRaisedAfter,
                buy_index: e.buyIndex,
                actual_seconds_added: e.actualSecondsAdded,
                timer_hard_reset: e.timerHardReset,
                battle_points_after: e.battlePointsAfter,
                bp_base_buy: e.bpBaseBuy,
                bp_timer_reset_bonus: e.bpTimerResetBonus,
                bp_clutch_bonus: e.bpClutchBonus,
                bp_streak_break_bonus: e.bpStreakBreakBonus,
                bp_ambush_bonus: e.bpAmbushBonus,
                bp_flag_penalty: e.bpFlagPenalty,
                flag_planted: e.flagPlanted,
                buyer_total_effective_timer_sec: e.buyerTotalEffectiveTimerSecAdded,
                buyer_active_defended_streak: e.buyerActiveDefendedStreak,
                buyer_best_defended_streak: e.buyerBestDefendedStreak,
            };
        }
    }
    if topic0 == TimeCurveBuyV2Activity::Buy::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveBuyV2Activity::Buy::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuy {
                buyer: e.buyer,
                charm_wad: e.charmWad,
                amount: e.amount,
                price_per_charm_wad: e.pricePerCharmWad,
                new_deadline: e.newDeadline,
                total_raised_after: e.totalRaisedAfter,
                buy_index: e.buyIndex,
                actual_seconds_added: e.actualSecondsAdded,
                // Activity-era `Buy` had no timer-hard-reset flag; do not map `activityAttack` here.
                timer_hard_reset: false,
                battle_points_after: e.buyerActivityPointsAfter,
                bp_base_buy: U256::ZERO,
                bp_timer_reset_bonus: U256::ZERO,
                bp_clutch_bonus: U256::ZERO,
                bp_streak_break_bonus: U256::ZERO,
                bp_ambush_bonus: U256::ZERO,
                bp_flag_penalty: U256::ZERO,
                flag_planted: false,
                buyer_total_effective_timer_sec: e.buyerTotalEffectiveTimerSecAdded,
                buyer_active_defended_streak: e.buyerActiveDefendedStreak,
                buyer_best_defended_streak: e.buyerBestDefendedStreak,
            };
        }
    }
    if topic0 == TimeCurveBuyLegacy::Buy::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveBuyLegacy::Buy::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuy {
                buyer: e.buyer,
                charm_wad: e.charmWad,
                amount: e.amount,
                price_per_charm_wad: e.pricePerCharmWad,
                new_deadline: e.newDeadline,
                total_raised_after: e.totalRaisedAfter,
                buy_index: e.buyIndex,
                actual_seconds_added: U256::ZERO,
                timer_hard_reset: false,
                battle_points_after: U256::ZERO,
                bp_base_buy: U256::ZERO,
                bp_timer_reset_bonus: U256::ZERO,
                bp_clutch_bonus: U256::ZERO,
                bp_streak_break_bonus: U256::ZERO,
                bp_ambush_bonus: U256::ZERO,
                bp_flag_penalty: U256::ZERO,
                flag_planted: false,
                buyer_total_effective_timer_sec: U256::ZERO,
                buyer_active_defended_streak: U256::ZERO,
                buyer_best_defended_streak: U256::ZERO,
            };
        }
    }
    if topic0 == TimeCurveEvents::SaleEnded::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::SaleEnded::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveSaleEnded {
                end_timestamp: e.endTimestamp,
                total_raised: e.totalRaised,
                total_buys: e.totalBuys,
            };
        }
    }
    if topic0 == TimeCurveEvents::CharmsRedeemed::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::CharmsRedeemed::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveCharmsRedeemed {
                buyer: e.buyer,
                token_amount: e.tokenAmount,
            };
        }
    }
    if topic0 == TimeCurveEventsLegacy::AllocationClaimed::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEventsLegacy::AllocationClaimed::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveCharmsRedeemed {
                buyer: e.buyer,
                token_amount: e.tokenAmount,
            };
        }
    }
    if topic0 == TimeCurveEvents::PrizesDistributed::SIGNATURE_HASH
        && TimeCurveEvents::PrizesDistributed::decode_log(log, true).is_ok()
    {
        return DecodedEvent::TimeCurvePrizesDistributed;
    }
    if topic0 == TimeCurveEvents::ReferralApplied::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::ReferralApplied::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveReferralApplied {
                buyer: e.buyer,
                referrer: e.referrer,
                code_hash: e.codeHash,
                referrer_amount: e.referrerCharmAdded,
                referee_amount: e.refereeCharmAdded,
                amount_to_fee_router: e.grossAmountRoutedToFeeRouter,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowSteal::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowSteal::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowSteal {
                attacker: e.attacker,
                victim: e.victim,
                amount_bp: e.amountBp,
                burn_paid_wad: e.burnPaidWad,
                bypassed_victim_daily_limit: e.bypassedVictimDailyLimit,
                victim_bp_after: e.victimBpAfter,
                attacker_bp_after: e.attackerBpAfter,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowRevenge::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowRevenge::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowRevenge {
                avenger: e.avenger,
                stealer: e.stealer,
                amount_bp: e.amountBp,
                burn_paid_wad: e.burnPaidWad,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowGuardActivated::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowGuardActivated::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowGuardActivated {
                player: e.player,
                guard_until_ts: e.guardUntilTs,
                burn_paid_wad: e.burnPaidWad,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowFlagClaimed::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowFlagClaimed::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowFlagClaimed {
                player: e.player,
                bonus_bp: e.bonusBp,
                battle_points_after: e.battlePointsAfter,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowFlagPenalized::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowFlagPenalized::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowFlagPenalized {
                former_holder: e.formerHolder,
                penalty_bp: e.penaltyBp,
                triggering_buyer: e.triggeringBuyer,
                battle_points_after: e.battlePointsAfter,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowCl8yBurned::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowCl8yBurned::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowCl8yBurned {
                payer: e.payer,
                reason: e.reason,
                amount_wad: e.amountWad,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowDefendedStreakContinued::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowDefendedStreakContinued::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowDefendedStreakContinued {
                wallet: e.wallet,
                active_streak: e.activeStreak,
                best_streak: e.bestStreak,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowDefendedStreakBroken::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowDefendedStreakBroken::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowDefendedStreakBroken {
                former_holder: e.formerHolder,
                interrupter: e.interrupter,
                broken_active_length: e.brokenActiveLength,
            };
        }
    }
    if topic0 == TimeCurveEvents::WarBowDefendedStreakWindowCleared::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::WarBowDefendedStreakWindowCleared::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveWarBowDefendedStreakWindowCleared {
                cleared_wallet: e.clearedWallet,
            };
        }
    }
    if topic0 == TimeCurveEvents::BuyFeeRoutingEnabled::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::BuyFeeRoutingEnabled::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuyFeeRoutingEnabled {
                enabled: e.enabled,
            };
        }
    }
    if topic0 == TimeCurveEvents::CharmRedemptionEnabled::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::CharmRedemptionEnabled::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveCharmRedemptionEnabled {
                enabled: e.enabled,
            };
        }
    }
    if topic0 == TimeCurveEvents::ReservePodiumPayoutsEnabled::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::ReservePodiumPayoutsEnabled::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveReservePodiumPayoutsEnabled {
                enabled: e.enabled,
            };
        }
    }
    if topic0 == TimeCurveEvents::TimeCurveBuyRouterSet::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::TimeCurveBuyRouterSet::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuyRouterSet {
                router: e.router,
            };
        }
    }
    if topic0 == TimeCurveEvents::DoubPresaleVestingSet::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveEvents::DoubPresaleVestingSet::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveDoubPresaleVestingSet {
                vesting: e.vesting,
            };
        }
    }
    if topic0 == TimeCurveBuyRouterEvents::BuyViaKumbaya::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveBuyRouterEvents::BuyViaKumbaya::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuyRouterBuyViaKumbaya {
                buyer: e.buyer,
                charm_wad: e.charmWad,
                gross_cl8y: e.grossCl8y,
                pay_kind: e.payKind,
            };
        }
    }
    if topic0 == TimeCurveBuyRouterEvents::Cl8ySurplusToProtocol::SIGNATURE_HASH {
        if let Ok(d) = TimeCurveBuyRouterEvents::Cl8ySurplusToProtocol::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::TimeCurveBuyRouterCl8ySurplus {
                amount: e.amount,
            };
        }
    }
    if topic0 == ReferralRegistryEvents::ReferralCodeRegistered::SIGNATURE_HASH {
        if let Ok(d) = ReferralRegistryEvents::ReferralCodeRegistered::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::ReferralCodeRegistered {
                owner: e.owner,
                code_hash: e.codeHash,
                normalized_code: e.normalizedCode,
            };
        }
    }
    if topic0 == PodiumPoolEvents::PodiumPaid::SIGNATURE_HASH {
        if let Ok(d) = PodiumPoolEvents::PodiumPaid::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::PodiumPoolPaid {
                winner: e.winner,
                token: e.token,
                amount: e.amount,
                category: e.category,
                placement: e.placement,
            };
        }
    }
    if topic0 == PodiumPoolEvents::PodiumResidualForwarded::SIGNATURE_HASH {
        if let Ok(d) = PodiumPoolEvents::PodiumResidualForwarded::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::PodiumPoolResidualForwarded {
                token: e.token,
                recipient: e.recipient,
                amount: e.amount,
                category: e.category,
            };
        }
    }
    if topic0 == PodiumPoolEvents::PrizePusherSet::SIGNATURE_HASH {
        if let Ok(d) = PodiumPoolEvents::PrizePusherSet::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::PodiumPoolPrizePusherSet {
                pusher: e.pusher,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowEpochOpened::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowEpochOpened::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitEpochOpened {
                epoch_id: e.epochId,
                start_timestamp: e.startTimestamp,
                end_timestamp: e.endTimestamp,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowHealthEpochFinalized::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowHealthEpochFinalized::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitHealthEpochFinalized {
                epoch_id: e.epochId,
                finalized_at: e.finalizedAt,
                reserve_ratio_wad: e.reserveRatioWad,
                doub_total_supply: e.doubTotalSupply,
                repricing_factor_wad: e.repricingFactorWad,
                backing_per_doubloon_wad: e.backingPerDoubloonWad,
                internal_state_e_wad: e.internalStateEWad,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowEpochReserveSnapshot::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowEpochReserveSnapshot::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitEpochReserveSnapshot {
                epoch_id: e.epochId,
                reserve_asset: e.reserveAsset,
                balance: e.balance,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowReserveBalanceUpdated::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowReserveBalanceUpdated::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitReserveBalanceUpdated {
                reserve_asset: e.reserveAsset,
                balance_after: e.balanceAfter,
                delta: e.delta.to_string(),
                reason_code: e.reasonCode,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowDeposited::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowDeposited::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitDeposit {
                user: e.user,
                reserve_asset: e.reserveAsset,
                amount: e.amount,
                doub_out: e.doubOut,
                epoch_id: e.epochId,
                faction_id: e.factionId,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowWithdrawn::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowWithdrawn::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitWithdrawal {
                user: e.user,
                reserve_asset: e.reserveAsset,
                amount: e.amount,
                doub_in: e.doubIn,
                epoch_id: e.epochId,
                faction_id: e.factionId,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowFeeAccrued::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowFeeAccrued::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitFeeAccrued {
                asset: e.asset,
                amount: e.amount,
                cumulative_in_asset: e.cumulativeInAsset,
                epoch_id: e.epochId,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowReserveBuckets::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowReserveBuckets::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitBurrowReserveBuckets {
                epoch_id: e.epochId,
                redeemable_backing: e.redeemableBacking,
                protocol_owned_backing: e.protocolOwnedBacking,
                total_backing: e.totalBacking,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowProtocolRevenueSplit::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowProtocolRevenueSplit::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitProtocolRevenueSplit {
                epoch_id: e.epochId,
                gross_amount: e.grossAmount,
                to_protocol_bucket: e.toProtocolBucket,
                burned_amount: e.burnedAmount,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowWithdrawalFeeAccrued::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowWithdrawalFeeAccrued::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitWithdrawalFeeAccrued {
                asset: e.asset,
                fee_amount: e.feeAmount,
                cumulative_withdraw_fees: e.cumulativeWithdrawFees,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::BurrowRepricingApplied::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::BurrowRepricingApplied::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitRepricingApplied {
                epoch_id: e.epochId,
                repricing_factor_wad: e.repricingFactorWad,
                prior_internal_price_wad: e.priorInternalPriceWad,
                new_internal_price_wad: e.newInternalPriceWad,
            };
        }
    }
    if topic0 == RabbitTreasuryEvents::ParamsUpdated::SIGNATURE_HASH {
        if let Ok(d) = RabbitTreasuryEvents::ParamsUpdated::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::RabbitParamsUpdated {
                actor: e.actor,
                param_name: e.paramName,
                old_value: e.oldValue,
                new_value: e.newValue,
            };
        }
    }
    if topic0 == LeprechaunEvents::SeriesCreated::SIGNATURE_HASH {
        if let Ok(d) = LeprechaunEvents::SeriesCreated::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::NftSeriesCreated {
                series_id: e.seriesId,
                max_supply: e.maxSupply,
            };
        }
    }
    if topic0 == LeprechaunEvents::Minted::SIGNATURE_HASH {
        if let Ok(d) = LeprechaunEvents::Minted::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::NftMinted {
                token_id: e.tokenId,
                series_id: e.seriesId,
                to: e.to,
            };
        }
    }
    if topic0 == FeeRouterEvents::SinksUpdated::SIGNATURE_HASH {
        if let Ok(d) = FeeRouterEvents::SinksUpdated::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::FeeRouterSinksUpdated {
                actor: e.actor,
                old_destinations: e.oldDestinations,
                old_weights: e.oldWeights,
                new_destinations: e.newDestinations,
                new_weights: e.newWeights,
            };
        }
    }
    if topic0 == FeeRouterEvents::FeesDistributed::SIGNATURE_HASH {
        if let Ok(d) = FeeRouterEvents::FeesDistributed::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::FeeRouterFeesDistributed {
                token: e.token,
                amount: e.amount,
                shares: e.shares,
            };
        }
    }
    if topic0 == DoubPresaleVestingEvents::VestingStarted::SIGNATURE_HASH {
        if let Ok(d) = DoubPresaleVestingEvents::VestingStarted::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::DoubVestingStarted {
                start_timestamp: e.startTimestamp,
                duration_sec: e.durationSec,
                total_allocated: e.totalAllocated_,
            };
        }
    }
    if topic0 == DoubPresaleVestingEvents::Claimed::SIGNATURE_HASH {
        if let Ok(d) = DoubPresaleVestingEvents::Claimed::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::DoubVestingClaimed {
                beneficiary: e.beneficiary,
                amount: e.amount,
            };
        }
    }
    if topic0 == DoubPresaleVestingEvents::ClaimsEnabled::SIGNATURE_HASH {
        if let Ok(d) = DoubPresaleVestingEvents::ClaimsEnabled::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::DoubVestingClaimsEnabled {
                enabled: e.enabled,
            };
        }
    }
    if topic0 == FeeSinkEvents::Withdrawn::SIGNATURE_HASH {
        if let Ok(d) = FeeSinkEvents::Withdrawn::decode_log(log, true) {
            let e = d.data;
            return DecodedEvent::FeeSinkWithdrawn {
                token: e.token,
                recipient: e.to,
                amount: e.amount,
                actor: e.actor,
            };
        }
    }

    DecodedEvent::Unknown { topic0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::{Log, U256};

    #[test]
    fn roundtrip_sale_started() {
        let e = TimeCurveEvents::SaleStarted {
            startTimestamp: U256::from(1u64),
            initialDeadline: U256::from(2u64),
            totalTokensForSale: U256::from(3u64),
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(0xab),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::TimeCurveSaleStarted {
                start_timestamp,
                initial_deadline,
                total_tokens_for_sale,
            } => {
                assert_eq!(start_timestamp, U256::from(1u64));
                assert_eq!(initial_deadline, U256::from(2u64));
                assert_eq!(total_tokens_for_sale, U256::from(3u64));
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_buy_via_kumbaya() {
        let buyer = Address::repeat_byte(0x77);
        let charm_wad = U256::from(10u128.pow(18)) * U256::from(2u8);
        let e = TimeCurveBuyRouterEvents::BuyViaKumbaya {
            buyer,
            charmWad: charm_wad,
            grossCl8y: U256::from(5u64),
            payKind: 1u8,
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(0x55),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::TimeCurveBuyRouterBuyViaKumbaya {
                buyer: b,
                charm_wad,
                gross_cl8y,
                pay_kind,
            } => {
                assert_eq!(b, buyer);
                assert_eq!(charm_wad, U256::from(10u128.pow(18)) * U256::from(2u8));
                assert_eq!(gross_cl8y, U256::from(5u64));
                assert_eq!(pay_kind, 1u8);
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_buy() {
        let buyer = Address::repeat_byte(0xcd);
        let e = TimeCurveEvents::Buy {
            buyer,
            charmWad: U256::from(100u64),
            amount: U256::from(100u64),
            pricePerCharmWad: U256::from(1u64),
            newDeadline: U256::from(999u64),
            totalRaisedAfter: U256::from(1000u64),
            buyIndex: U256::from(0u64),
            actualSecondsAdded: U256::from(120u64),
            timerHardReset: false,
            battlePointsAfter: U256::from(250u64),
            bpBaseBuy: U256::from(250u64),
            bpTimerResetBonus: U256::ZERO,
            bpClutchBonus: U256::ZERO,
            bpStreakBreakBonus: U256::ZERO,
            bpAmbushBonus: U256::ZERO,
            bpFlagPenalty: U256::ZERO,
            flagPlanted: true,
            buyerTotalEffectiveTimerSecAdded: U256::from(120u64),
            buyerActiveDefendedStreak: U256::ZERO,
            buyerBestDefendedStreak: U256::ZERO,
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(1),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::TimeCurveBuy {
                buyer: b,
                amount,
                buy_index,
                ..
            } => {
                assert_eq!(b, buyer);
                assert_eq!(amount, U256::from(100u64));
                assert_eq!(buy_index, U256::ZERO);
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_health_epoch_finalized() {
        let e = RabbitTreasuryEvents::BurrowHealthEpochFinalized {
            epochId: U256::from(3u64),
            finalizedAt: U256::from(100u64),
            reserveRatioWad: U256::from(5u64),
            doubTotalSupply: U256::from(6u64),
            repricingFactorWad: U256::from(7u64),
            backingPerDoubloonWad: U256::from(8u64),
            internalStateEWad: U256::from(9u64),
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(3),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::RabbitHealthEpochFinalized { epoch_id, .. } => {
                assert_eq!(epoch_id, U256::from(3u64));
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_reserve_balance_negative_delta() {
        use alloy_primitives::I256;
        let e = RabbitTreasuryEvents::BurrowReserveBalanceUpdated {
            reserveAsset: Address::repeat_byte(0x11),
            balanceAfter: U256::from(1000u64),
            delta: I256::try_from(-50i32).expect("delta"),
            reasonCode: 2,
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(4),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::RabbitReserveBalanceUpdated {
                delta, reason_code, ..
            } => {
                assert_eq!(delta, "-50");
                assert_eq!(reason_code, 2);
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_warbow_cl8y_burned() {
        let payer = Address::repeat_byte(0x33);
        let e = TimeCurveEvents::WarBowCl8yBurned {
            payer,
            reason: 2u8,
            amountWad: U256::from(10u128.pow(18)),
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(0xab),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::TimeCurveWarBowCl8yBurned {
                payer: p,
                reason,
                amount_wad,
            } => {
                assert_eq!(p, payer);
                assert_eq!(reason, 2);
                assert_eq!(amount_wad, U256::from(10u128.pow(18)));
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_warbow_steal() {
        let attacker = Address::repeat_byte(0x11);
        let victim = Address::repeat_byte(0x22);
        let e = TimeCurveEvents::WarBowSteal {
            attacker,
            victim,
            amountBp: U256::from(50u64),
            burnPaidWad: U256::from(1u64),
            bypassedVictimDailyLimit: true,
            victimBpAfter: U256::from(900u64),
            attackerBpAfter: U256::from(100u64),
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(0xab),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::TimeCurveWarBowSteal {
                attacker: a,
                victim: v,
                amount_bp,
                bypassed_victim_daily_limit,
                ..
            } => {
                assert_eq!(a, attacker);
                assert_eq!(v, victim);
                assert_eq!(amount_bp, U256::from(50u64));
                assert!(bypassed_victim_daily_limit);
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_doub_vesting_claimed() {
        let ben = Address::repeat_byte(0xaa);
        let e = DoubPresaleVestingEvents::Claimed {
            beneficiary: ben,
            amount: U256::from(555u64),
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(0xfe),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::DoubVestingClaimed {
                beneficiary: b,
                amount,
            } => {
                assert_eq!(b, ben);
                assert_eq!(amount, U256::from(555u64));
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_fee_sink_withdrawn() {
        let token = Address::repeat_byte(0x01);
        let to = Address::repeat_byte(0x02);
        let actor = Address::repeat_byte(0x03);
        let e = FeeSinkEvents::Withdrawn {
            token,
            to,
            amount: U256::from(777u64),
            actor,
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(0xbd),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::FeeSinkWithdrawn {
                token: t,
                recipient,
                amount,
                actor: a,
            } => {
                assert_eq!(t, token);
                assert_eq!(recipient, to);
                assert_eq!(amount, U256::from(777u64));
                assert_eq!(a, actor);
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }

    #[test]
    fn roundtrip_minted() {
        let e = LeprechaunEvents::Minted {
            tokenId: U256::from(7u64),
            seriesId: U256::from(1u64),
            to: Address::repeat_byte(0xee),
        };
        let data = e.encode_log_data();
        let log = Log::new_unchecked(
            Address::repeat_byte(2),
            data.topics().to_vec(),
            data.data.clone(),
        );
        let topic0 = *log.topics().first().unwrap();
        let dec = decode_primitive_log(&log, topic0);
        match dec {
            DecodedEvent::NftMinted {
                token_id,
                series_id,
                to,
            } => {
                assert_eq!(token_id, U256::from(7u64));
                assert_eq!(series_id, U256::from(1u64));
                assert_eq!(to, Address::repeat_byte(0xee));
            }
            _ => panic!("wrong variant: {dec:?}"),
        }
    }
}
