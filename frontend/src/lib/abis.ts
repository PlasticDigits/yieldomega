// SPDX-License-Identifier: AGPL-3.0-only

import { parseAbi } from "viem";

/** Minimal fragment for `useWatchContractEvent` — refetch deadline right after buys. */
export const timeArenaBuyEventAbi = parseAbi([
  "event Buy(address indexed buyer, uint256 charmWad, uint256 amount, uint256 pricePerCharmWad, uint256 newDeadline, uint256 totalRaisedAfter, uint256 buyIndex, uint256 actualSecondsAdded, bool timerHardReset, uint256 battlePointsAfter, uint256 bpBaseBuy, uint256 bpTimerResetBonus, uint256 bpClutchBonus, uint256 bpStreakBreakBonus, uint256 bpAmbushBonus, uint256 bpFlagPenalty, bool flagPlanted, uint256 buyerTotalEffectiveTimerSecAdded, uint256 buyerActiveDefendedStreak, uint256 buyerBestDefendedStreak)",
]);

/** Buy receipt log — mirrors onchain `XpGained` for optimistic wallet XP (#301). */
export const timeArenaXpGainedEventAbi = parseAbi([
  "event XpGained(address indexed player, uint256 amount, uint256 newLevel)",
]);

/**
 * WarBow events that should refresh live reads (podium / leaderboard / per-wallet `warbowGuardUntil`).
 * Includes BP-moving txs plus **`WarBowGuardActivated`** (guard windows; GitLab #101 follow-up).
 */
export const timeArenaWarbowBpEventAbi = parseAbi([
  "event WarBowSteal(address indexed attacker, address indexed victim, uint256 amountBp, uint256 burnPaidWad, bool bypassedVictimDailyLimit, uint256 victimBpAfter, uint256 attackerBpAfter)",
  "event WarBowRevenge(address indexed avenger, address indexed stealer, uint256 amountBp, uint256 burnPaidWad, uint256 stealerBpAfter, uint256 avengerBpAfter)",
  "event WarBowFlagClaimed(address indexed player, uint256 bonusBp, uint256 battlePointsAfter)",
  "event WarBowFlagPenalized(address indexed formerHolder, uint256 penaltyBp, address indexed triggeringBuyer, uint256 battlePointsAfter)",
  "event WarBowGuardActivated(address indexed player, uint256 guardUntilTs, uint256 burnPaidWad)",
]);

export const WARBOW_BP_MOVING_EVENT_NAMES = [
  "WarBowSteal",
  "WarBowRevenge",
  "WarBowFlagClaimed",
  "WarBowFlagPenalized",
] as const;

/** TimeArena v2 onchain reads (GitLab #256). */
export const timeArenaReadAbi = parseAbi([
  "function arenaStart() view returns (uint256)",
  "function deadline() view returns (uint256)",
  "function lastBuyEpoch() view returns (uint256)",
  "function podiumDeadline(uint8) view returns (uint256)",
  "function podiumEpoch(uint8) view returns (uint256)",
  "function charmPriceWad() view returns (uint256)",
  "function epochCharmAnchorWad() view returns (uint256)",
  "function effectiveCharmPriceWad() view returns (uint256)",
  "function epochAnchorTimestamp() view returns (uint256)",
  "function paused() view returns (bool)",
  "function doub() view returns (address)",
  "function referralRegistry() view returns (address)",
  "function totalDoubRaised() view returns (uint256)",
  "function buyCooldownSec() view returns (uint256)",
  "function buyChargeIntervalSec() view returns (uint256)",
  "function maxBuyCharges() view returns (uint8)",
  "function burstBuyCooldownSec() view returns (uint256)",
  "function buyEnergyState(address) view returns (uint8 charges, uint8 maxCharges, uint256 lastRefillAt, uint256 lastBuyAt, uint256 nextChargeAt, uint256 nextAllowedAt)",
  "function timerExtensionSec() view returns (uint256)",
  "function initialTimerSec() view returns (uint256)",
  "function timerCapSec() view returns (uint256)",
  "function podiumTimerExtensionSec(uint256) view returns (uint256)",
  "function podiumInitialTimerSec(uint256) view returns (uint256)",
  "function podiumTimerCapSec(uint256) view returns (uint256)",
  "function podiumResetBelowRemainingSec(uint256) view returns (uint256)",
  "function podiumResetToRemainingSec(uint256) view returns (uint256)",
  "function timeArenaBuyRouter() view returns (address)",
  "function owner() view returns (address)",
  "function nextBuyAllowedAt(address) view returns (uint256)",
  "function epochCharmWad(uint256 epoch, address user) view returns (uint256)",
  "function pendingCred(address user, uint256 epoch) view returns (uint256)",
  "function claimCred(uint256 epoch)",
  "function buyWithCred(uint256 charmWad)",
  "function buy(uint256 charmWad)",
  "function buy(uint256 charmWad, bytes32 codeHash)",
  "function playCred() view returns (address)",
  "function CRED_PER_CHARM_WAD() view returns (uint256)",
  "function REFERRAL_CRED_FLAT_WAD() view returns (uint256)",
  "function xp(address) view returns (uint256)",
  "function xpTowardNext(address) view returns (uint256)",
  "function level(address) view returns (uint256)",
  "function battlePoints(address) view returns (uint256)",
  "function charmWeight(address) view returns (uint256)",
  "function buyCount(address) view returns (uint256)",
  "function totalEffectiveTimerSecAdded(address) view returns (uint256)",
  "function activeDefendedStreak(address) view returns (uint256)",
  "function bestDefendedStreak(address) view returns (uint256)",
  "function warbowPendingFlagOwner() view returns (address)",
  "function warbowPendingFlagPlantAt() view returns (uint256)",
  "function warbowGuardUntil(address) view returns (uint256)",
  "function podium(uint8 category) view returns (address[3] winners, uint256[3] values)",
  "function stealsReceivedOnDay(address victim, uint256 day) view returns (uint8)",
  "function stealsCommittedByAttackerOnDay(address attacker, uint256 day) view returns (uint8)",
  "function WARBOW_STEAL_DOUB() view returns (uint256)",
  "function WARBOW_GUARD_DOUB() view returns (uint256)",
  "function WARBOW_STEAL_LIMIT_BYPASS_DOUB() view returns (uint256)",
  "function WARBOW_FLAG_SILENCE_SEC() view returns (uint256)",
  "function WARBOW_FLAG_CLAIM_BP() view returns (uint256)",
  "function WARBOW_MAX_STEALS_PER_DAY() view returns (uint8)",
  "function SECONDS_PER_DAY() view returns (uint256)",
  "function WARBOW_REVENGE_WINDOW_SEC() view returns (uint256)",
  "function WARBOW_REVENGE_DOUB() view returns (uint256)",
]);

export const timeArenaWriteAbi = parseAbi([
  "function buy(uint256 charmWad)",
  "function buy(uint256 charmWad, bytes32 codeHash)",
  "function buyWithCred(uint256 charmWad)",
  "function topUpPodiumPools(uint256 amountDoubWad)",
  "function claimWarBowFlag()",
  "function warbowSteal(address victim, bool payBypassBurn)",
  "function warbowRevenge(address stealer)",
  "function warbowActivateGuard()",
]);

/** [`TimeArenaBuyRouter.buyViaKumbaya`](../../contracts/src/arena/TimeArenaBuyRouter.sol) — #251 / #264. */
export const timeArenaBuyRouterAbi = parseAbi([
  "function buyViaKumbaya(uint256 charmWad, bytes32 codeHash, bool plantWarBowFlag, uint8 payKind, uint256 swapDeadline, uint256 amountInMaximum, bytes path) payable",
  "error TimeArenaBuyRouter__BadPhase()",
  "error TimeArenaBuyRouter__BadPath()",
  "error TimeArenaBuyRouter__CharmBounds()",
  "error TimeArenaBuyRouter__StableNotConfigured()",
  "error TimeArenaBuyRouter__StableIngressParity()",
  "error TimeArenaBuyRouter__SwapExpired()",
]);

export const referralRegistryReadAbi = parseAbi([
  "function doubToken() view returns (address)",
  "function cl8yToken() view returns (address)",
  "function timeArena() view returns (address)",
  "function ownerCode(address owner) view returns (bytes32)",
  "function hashCode(string code) view returns (bytes32)",
  "function ownerOfCode(bytes32 codeHash) view returns (address)",
  "function registrationBurnAmount() view returns (uint256)",
]);

export const referralRegistryWriteAbi = parseAbi(["function registerCode(string code)"]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

/** WETH9-style wrap / unwrap (issue #41). */
export const weth9Abi = parseAbi([
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

/**
 * Anvil fixture + Uniswap V3 QuoterV2-style interface (`quoteExactOutput`).
 * Returns: amountIn, sqrtPriceAfterList, initializedTicksCrossedList, gasEstimate
 */
export const kumbayaQuoterV2Abi = parseAbi([
  "function quoteExactOutput(bytes path, uint256 amountOut) view returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
  "function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

/** Kumbaya IV3SwapRouter (`@kumbaya_xyz/swap-router-contracts`) — not legacy Uniswap SwapRouter02 (issue #41). */
export const kumbayaSwapRouterAbi = parseAbi([
  "function exactOutput((bytes path, address recipient, uint256 amountOut, uint256 amountInMaximum)) returns (uint256 amountIn)",
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) returns (uint256 amountIn)",
]);

export const leprechaunReadAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
]);
