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
        contract TimeCurveEvents {
            event SaleStarted(uint256 startTimestamp, uint256 initialDeadline, uint256 totalTokensForSale);
            event Buy(
                address indexed buyer,
                uint256 charmWad,
                uint256 amount,
                uint256 pricePerCharmWad,
                uint256 newDeadline,
                uint256 totalRaisedAfter,
                uint256 buyIndex
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
}

use contracts::{
    FeeRouterEvents, LeprechaunEvents, PodiumPoolEvents, RabbitTreasuryEvents,
    ReferralRegistryEvents, TimeCurveEvents, TimeCurveEventsLegacy,
};

/// Fully decoded log plus block metadata for persistence.
#[derive(Debug, Clone)]
pub struct DecodedLog {
    pub block_number: u64,
    pub block_hash: B256,
    pub tx_hash: B256,
    pub log_index: u64,
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
    },
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
