// SPDX-License-Identifier: AGPL-3.0-or-later

//! ABI event decoding for Arena v2 (`TimeArena`) and `ReferralRegistry`.

use alloy_primitives::{Address, Log, B256, U256};
use alloy_rpc_types::Log as RpcLog;
use alloy_sol_types::SolEvent;

mod contracts {
    use alloy_sol_types::sol;

    sol! {
        contract ReferralRegistryEvents {
            event ReferralCodeRegistered(address indexed owner, bytes32 indexed codeHash, string normalizedCode);
        }
    }

    sol! {
        contract PodiumVaultsEvents {
            event PodiumFunded(uint8 indexed podiumId, uint256 amount, address indexed pool);
            event SeedFunded(uint8 indexed podiumId, uint256 amount, address indexed pool);
            event PodiumEpochFunded(uint8 indexed category, uint256 indexed epoch, uint256 amount, address indexed pool);
        }
    }

    sol! {
        contract AdminSellVaultEvents {
            event AdminVaultFunded(uint256 amount);
        }
    }

    sol! {
        contract TimeArenaEvents {
            event ArenaStarted(uint256 startTimestamp, uint256 initialDeadline);
            event LastBuyEpochStarted(uint256 indexed epoch, uint256 deadline);
            event LastBuyEpochCharmAnchored(
                uint256 indexed epoch,
                uint256 anchorWad,
                uint256 doubUsdWad,
                uint256 anchorTimestamp
            );
            event Buy(
                address indexed buyer,
                uint256 charmWad,
                uint256 doubPaid,
                uint256 newDeadline,
                uint256 totalDoubRaisedAfter,
                uint256 buyIndex,
                uint256 actualSecondsAdded,
                bool timerHardReset,
                bool paidWithCred
            );
            event ReferralCredApplied(
                address indexed buyer,
                address indexed referrer,
                bytes32 indexed codeHash,
                uint256 referrerCred,
                uint256 buyerCred
            );
            event PodiumEpochRolled(
                uint8 indexed category,
                uint256 indexed epoch,
                address first,
                address second,
                address third,
                uint256 poolPaid
            );
            event CredClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
            event FirstBuyCredScheduled(address indexed buyer, uint256 indexed targetEpoch, uint256 amount);
            event XpGained(address indexed player, uint256 amount, uint256 newLevel);
            event LevelUp(address indexed player, uint256 newLevel);
            event FeatureUnlocked(address indexed player, uint256 featureLevel);
            event WarBowSteal(
                address indexed attacker,
                address indexed victim,
                uint256 bpTaken,
                uint256 doubSpent,
                bool limitBypassBurned
            );
            event WarBowGuard(address indexed player, uint256 doubSpent, uint256 guardUntil);
            event WarBowRevenge(address indexed avenger, address indexed stealer, uint256 bpTaken, uint256 doubSpent);
            event WarBowFlagClaimed(address indexed player, uint256 bonusBp);
            event WarbowPodiumFinalized(uint256 indexed epoch, address first, address second, address third);
            event ReferralApplied(
                address indexed buyer,
                address indexed referrer,
                bytes32 indexed codeHash,
                uint256 referrerCharm,
                uint256 buyerCharm,
                uint256 doubPaid
            );
            event PausedSet(bool paused);
            event PodiumPoolsToppedUp(address indexed donor, uint256 amountDoubWad);
        }
    }
}

use contracts::{
    AdminSellVaultEvents, PodiumVaultsEvents, ReferralRegistryEvents, TimeArenaEvents,
};

/// Buy-sourced DOUB prize routing row kind (maps to `idx_arena_vault_funding.kind`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VaultFundingKind {
    PodiumActive,
    PodiumSeed,
    PodiumEpoch,
    Admin,
}

impl VaultFundingKind {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::PodiumActive => "podium_active",
            Self::PodiumSeed => "podium_seed",
            Self::PodiumEpoch => "podium_epoch",
            Self::Admin => "admin",
        }
    }
}

#[derive(Debug, Clone)]
pub struct DecodedLog {
    pub block_number: u64,
    pub block_hash: B256,
    pub tx_hash: B256,
    pub log_index: u64,
    pub block_timestamp: Option<u64>,
    pub contract: Address,
    pub event: DecodedEvent,
}

#[derive(Debug, Clone)]
pub enum DecodedEvent {
    ArenaStarted {
        start_timestamp: U256,
        initial_deadline: U256,
    },
    ArenaBuy {
        buyer: Address,
        charm_wad: U256,
        doub_paid: U256,
        new_deadline: U256,
        total_doub_raised_after: U256,
        buy_index: U256,
        actual_seconds_added: U256,
        timer_hard_reset: bool,
        paid_with_cred: bool,
    },
    ArenaReferralCred {
        buyer: Address,
        referrer: Address,
        code_hash: B256,
        referrer_cred: U256,
        buyer_cred: U256,
    },
    ArenaXpGained {
        player: Address,
        amount: U256,
        new_level: U256,
    },
    ArenaCredClaimed {
        user: Address,
        epoch: U256,
        amount: U256,
    },
    ArenaFirstBuyCredScheduled {
        buyer: Address,
        target_epoch: U256,
        amount: U256,
    },
    ArenaLevelUp {
        player: Address,
        new_level: U256,
    },
    ArenaFeatureUnlocked {
        player: Address,
        feature_level: U256,
    },
    ArenaPausedSet {
        paused: bool,
    },
    ArenaPodiumEpochRolled {
        category: u8,
        epoch: U256,
        first: Address,
        second: Address,
        third: Address,
        pool_paid: U256,
    },
    ArenaLastBuyEpochStarted {
        epoch: U256,
        deadline: U256,
    },
    ArenaLastBuyEpochCharmAnchored {
        epoch: U256,
        anchor_wad: U256,
        doub_usd_wad: U256,
        anchor_timestamp: U256,
    },
    ArenaWarbowSteal {
        attacker: Address,
        victim: Address,
        bp_taken: U256,
        doub_spent: U256,
        limit_bypass: bool,
    },
    ArenaWarbowGuard {
        player: Address,
        doub_spent: U256,
        guard_until: U256,
    },
    ArenaWarbowRevenge {
        avenger: Address,
        stealer: Address,
        bp_taken: U256,
        doub_spent: U256,
    },
    ArenaWarbowFlagClaimed {
        player: Address,
        bonus_bp: U256,
    },
    ArenaWarbowPodiumFinalized {
        epoch: U256,
        first: Address,
        second: Address,
        third: Address,
    },
    /// Explicit WarBow BP snapshot row (tests / operator backfill); not an onchain log topic.
    ArenaWarbowEpochScore {
        epoch: U256,
        player: Address,
        battle_points: U256,
    },
    ArenaReferralApplied {
        buyer: Address,
        referrer: Address,
        code_hash: B256,
        referrer_charm: U256,
        buyer_charm: U256,
        doub_paid: U256,
    },
    ReferralCodeRegistered {
        owner: Address,
        code_hash: B256,
        normalized_code: String,
    },
    ArenaPodiumPoolTopUp {
        donor: Address,
        amount_doub_wad: U256,
    },
    ArenaVaultFunding {
        kind: VaultFundingKind,
        podium_id: Option<u8>,
        target_epoch: Option<U256>,
        amount_doub_wad: U256,
        pool_address: Option<Address>,
    },
    Unknown {
        #[allow(dead_code)]
        topic0: B256,
    },
}

pub fn decode_rpc_log(rlog: &RpcLog) -> Option<DecodedLog> {
    let block_number = rlog.block_number?;
    let block_hash = rlog.block_hash?;
    let tx_hash = rlog.transaction_hash?;
    let log_index = rlog.log_index?;
    let inner = &rlog.inner;
    let topic0 = *inner.topics().first()?;
    Some(DecodedLog {
        block_number,
        block_hash,
        tx_hash,
        log_index,
        block_timestamp: rlog.block_timestamp,
        contract: inner.address,
        event: decode_primitive_log(inner, topic0),
    })
}

fn decode_primitive_log(log: &Log, topic0: B256) -> DecodedEvent {
    if topic0 == TimeArenaEvents::Buy::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::Buy::decode_log(log, true) {
            return DecodedEvent::ArenaBuy {
                buyer: e.buyer,
                charm_wad: e.charmWad,
                doub_paid: e.doubPaid,
                new_deadline: e.newDeadline,
                total_doub_raised_after: e.totalDoubRaisedAfter,
                buy_index: e.buyIndex,
                actual_seconds_added: e.actualSecondsAdded,
                timer_hard_reset: e.timerHardReset,
                paid_with_cred: e.paidWithCred,
            };
        }
    }
    if topic0 == TimeArenaEvents::ReferralCredApplied::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::ReferralCredApplied::decode_log(log, true) {
            return DecodedEvent::ArenaReferralCred {
                buyer: e.buyer,
                referrer: e.referrer,
                code_hash: e.codeHash,
                referrer_cred: e.referrerCred,
                buyer_cred: e.buyerCred,
            };
        }
    }
    if topic0 == TimeArenaEvents::XpGained::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::XpGained::decode_log(log, true) {
            return DecodedEvent::ArenaXpGained {
                player: e.player,
                amount: e.amount,
                new_level: e.newLevel,
            };
        }
    }
    if topic0 == TimeArenaEvents::CredClaimed::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::CredClaimed::decode_log(log, true) {
            return DecodedEvent::ArenaCredClaimed {
                user: e.user,
                epoch: e.epoch,
                amount: e.amount,
            };
        }
    }
    if topic0 == TimeArenaEvents::FirstBuyCredScheduled::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::FirstBuyCredScheduled::decode_log(log, true) {
            return DecodedEvent::ArenaFirstBuyCredScheduled {
                buyer: e.buyer,
                target_epoch: e.targetEpoch,
                amount: e.amount,
            };
        }
    }
    if topic0 == TimeArenaEvents::LevelUp::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::LevelUp::decode_log(log, true) {
            return DecodedEvent::ArenaLevelUp {
                player: e.player,
                new_level: e.newLevel,
            };
        }
    }
    if topic0 == TimeArenaEvents::FeatureUnlocked::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::FeatureUnlocked::decode_log(log, true) {
            return DecodedEvent::ArenaFeatureUnlocked {
                player: e.player,
                feature_level: e.featureLevel,
            };
        }
    }
    if topic0 == TimeArenaEvents::PausedSet::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::PausedSet::decode_log(log, true) {
            return DecodedEvent::ArenaPausedSet { paused: e.paused };
        }
    }
    if topic0 == TimeArenaEvents::PodiumEpochRolled::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::PodiumEpochRolled::decode_log(log, true) {
            return DecodedEvent::ArenaPodiumEpochRolled {
                category: e.category,
                epoch: e.epoch,
                first: e.first,
                second: e.second,
                third: e.third,
                pool_paid: e.poolPaid,
            };
        }
    }
    if topic0 == TimeArenaEvents::LastBuyEpochCharmAnchored::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::LastBuyEpochCharmAnchored::decode_log(log, true) {
            return DecodedEvent::ArenaLastBuyEpochCharmAnchored {
                epoch: e.epoch,
                anchor_wad: e.anchorWad,
                doub_usd_wad: e.doubUsdWad,
                anchor_timestamp: e.anchorTimestamp,
            };
        }
    }
    if topic0 == TimeArenaEvents::LastBuyEpochStarted::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::LastBuyEpochStarted::decode_log(log, true) {
            return DecodedEvent::ArenaLastBuyEpochStarted {
                epoch: e.epoch,
                deadline: e.deadline,
            };
        }
    }
    if topic0 == TimeArenaEvents::WarBowSteal::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::WarBowSteal::decode_log(log, true) {
            return DecodedEvent::ArenaWarbowSteal {
                attacker: e.attacker,
                victim: e.victim,
                bp_taken: e.bpTaken,
                doub_spent: e.doubSpent,
                limit_bypass: e.limitBypassBurned,
            };
        }
    }
    if topic0 == TimeArenaEvents::WarBowGuard::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::WarBowGuard::decode_log(log, true) {
            return DecodedEvent::ArenaWarbowGuard {
                player: e.player,
                doub_spent: e.doubSpent,
                guard_until: e.guardUntil,
            };
        }
    }
    if topic0 == TimeArenaEvents::WarBowRevenge::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::WarBowRevenge::decode_log(log, true) {
            return DecodedEvent::ArenaWarbowRevenge {
                avenger: e.avenger,
                stealer: e.stealer,
                bp_taken: e.bpTaken,
                doub_spent: e.doubSpent,
            };
        }
    }
    if topic0 == TimeArenaEvents::WarBowFlagClaimed::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::WarBowFlagClaimed::decode_log(log, true) {
            return DecodedEvent::ArenaWarbowFlagClaimed {
                player: e.player,
                bonus_bp: e.bonusBp,
            };
        }
    }
    if topic0 == TimeArenaEvents::WarbowPodiumFinalized::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::WarbowPodiumFinalized::decode_log(log, true) {
            return DecodedEvent::ArenaWarbowPodiumFinalized {
                epoch: e.epoch,
                first: e.first,
                second: e.second,
                third: e.third,
            };
        }
    }
    if topic0 == TimeArenaEvents::ReferralApplied::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::ReferralApplied::decode_log(log, true) {
            return DecodedEvent::ArenaReferralApplied {
                buyer: e.buyer,
                referrer: e.referrer,
                code_hash: e.codeHash,
                referrer_charm: e.referrerCharm,
                buyer_charm: e.buyerCharm,
                doub_paid: e.doubPaid,
            };
        }
    }
    if topic0 == TimeArenaEvents::ArenaStarted::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::ArenaStarted::decode_log(log, true) {
            return DecodedEvent::ArenaStarted {
                start_timestamp: e.startTimestamp,
                initial_deadline: e.initialDeadline,
            };
        }
    }
    if topic0 == ReferralRegistryEvents::ReferralCodeRegistered::SIGNATURE_HASH {
        if let Ok(e) = ReferralRegistryEvents::ReferralCodeRegistered::decode_log(log, true) {
            return DecodedEvent::ReferralCodeRegistered {
                owner: e.owner,
                code_hash: e.codeHash,
                normalized_code: e.normalizedCode.clone(),
            };
        }
    }
    if topic0 == TimeArenaEvents::PodiumPoolsToppedUp::SIGNATURE_HASH {
        if let Ok(e) = TimeArenaEvents::PodiumPoolsToppedUp::decode_log(log, true) {
            return DecodedEvent::ArenaPodiumPoolTopUp {
                donor: e.donor,
                amount_doub_wad: e.amountDoubWad,
            };
        }
    }
    if topic0 == PodiumVaultsEvents::PodiumFunded::SIGNATURE_HASH {
        if let Ok(e) = PodiumVaultsEvents::PodiumFunded::decode_log(log, true) {
            return DecodedEvent::ArenaVaultFunding {
                kind: VaultFundingKind::PodiumActive,
                podium_id: Some(e.podiumId),
                target_epoch: None,
                amount_doub_wad: e.amount,
                pool_address: Some(e.pool),
            };
        }
    }
    if topic0 == PodiumVaultsEvents::SeedFunded::SIGNATURE_HASH {
        if let Ok(e) = PodiumVaultsEvents::SeedFunded::decode_log(log, true) {
            return DecodedEvent::ArenaVaultFunding {
                kind: VaultFundingKind::PodiumSeed,
                podium_id: Some(e.podiumId),
                target_epoch: None,
                amount_doub_wad: e.amount,
                pool_address: Some(e.pool),
            };
        }
    }
    if topic0 == PodiumVaultsEvents::PodiumEpochFunded::SIGNATURE_HASH {
        if let Ok(e) = PodiumVaultsEvents::PodiumEpochFunded::decode_log(log, true) {
            return DecodedEvent::ArenaVaultFunding {
                kind: VaultFundingKind::PodiumEpoch,
                podium_id: Some(e.category),
                target_epoch: Some(e.epoch),
                amount_doub_wad: e.amount,
                pool_address: Some(e.pool),
            };
        }
    }
    if topic0 == AdminSellVaultEvents::AdminVaultFunded::SIGNATURE_HASH {
        if let Ok(e) = AdminSellVaultEvents::AdminVaultFunded::decode_log(log, true) {
            return DecodedEvent::ArenaVaultFunding {
                kind: VaultFundingKind::Admin,
                podium_id: None,
                target_epoch: None,
                amount_doub_wad: e.amount,
                pool_address: None,
            };
        }
    }

    DecodedEvent::Unknown { topic0 }
}
