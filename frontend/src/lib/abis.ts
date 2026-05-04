// SPDX-License-Identifier: AGPL-3.0-only

import { parseAbi } from "viem";

/** Minimal fragment for `useWatchContractEvent` — refetch deadline right after buys. */
export const timeCurveBuyEventAbi = parseAbi([
  "event Buy(address indexed buyer, uint256 charmWad, uint256 amount, uint256 pricePerCharmWad, uint256 newDeadline, uint256 totalRaisedAfter, uint256 buyIndex, uint256 actualSecondsAdded, bool timerHardReset, uint256 battlePointsAfter, uint256 bpBaseBuy, uint256 bpTimerResetBonus, uint256 bpClutchBonus, uint256 bpStreakBreakBonus, uint256 bpAmbushBonus, uint256 bpFlagPenalty, bool flagPlanted, uint256 buyerTotalEffectiveTimerSecAdded, uint256 buyerActiveDefendedStreak, uint256 buyerBestDefendedStreak)",
]);

export const timeCurveReadAbi = parseAbi([
  "function saleStart() view returns (uint256)",
  "function deadline() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function ended() view returns (bool)",
  "function currentMinBuyAmount() view returns (uint256)",
  "function currentMaxBuyAmount() view returns (uint256)",
  "function currentCharmBoundsWad() view returns (uint256 minCharmWad, uint256 maxCharmWad)",
  "function currentPricePerCharmWad() view returns (uint256)",
  "function charmPrice() view returns (address)",
  "function acceptedAsset() view returns (address)",
  "function referralRegistry() view returns (address)",
  "function REFERRAL_EACH_BPS() view returns (uint16)",
  "function initialMinBuy() view returns (uint256)",
  "function growthRateWad() view returns (uint256)",
  "function timerExtensionSec() view returns (uint256)",
  "function initialTimerSec() view returns (uint256)",
  "function timerCapSec() view returns (uint256)",
  "function totalTokensForSale() view returns (uint256)",
  "function launchedToken() view returns (address)",
  "function feeRouter() view returns (address)",
  "function podiumPool() view returns (address)",
  "function totalCharmWeight() view returns (uint256)",
  "function buyCooldownSec() view returns (uint256)",
  "function nextBuyAllowedAt(address) view returns (uint256)",
  "function podium(uint8 category) view returns (address[3] winners, uint256[3] values)",
  "function charmWeight(address user) view returns (uint256)",
  "function buyCount(address user) view returns (uint256)",
  "function charmsRedeemed(address user) view returns (bool)",
  "function totalEffectiveTimerSecAdded(address user) view returns (uint256)",
  "function battlePoints(address user) view returns (uint256)",
  "function activeDefendedStreak(address user) view returns (uint256)",
  "function bestDefendedStreak(address user) view returns (uint256)",
  "function NUM_PODIUM_CATEGORIES() view returns (uint8)",
  "function CAT_LAST_BUYERS() view returns (uint8)",
  "function CAT_TIME_BOOSTER() view returns (uint8)",
  "function CAT_DEFENDED_STREAK() view returns (uint8)",
  "function CAT_WARBOW() view returns (uint8)",
  "function DEFENDED_STREAK_WINDOW_SEC() view returns (uint256)",
  "function prizesDistributed() view returns (bool)",
  "function buyFeeRoutingEnabled() view returns (bool)",
  "function charmRedemptionEnabled() view returns (bool)",
  "function reservePodiumPayoutsEnabled() view returns (bool)",
  "function warbowLadderPodium() view returns (address[3] winners, uint256[3] values)",
  "function warbowPendingFlagOwner() view returns (address)",
  "function warbowPendingFlagPlantAt() view returns (uint256)",
  "function warbowGuardUntil(address player) view returns (uint256)",
  "function warbowPendingRevengeExpiryExclusive(address victim, address stealer) view returns (uint256)",
  "function warbowPendingRevengeStealSeq(address victim, address stealer) view returns (uint64)",
  "function stealsReceivedOnDay(address victim, uint256 day) view returns (uint8)",
  "function WARBOW_STEAL_BURN_WAD() view returns (uint256)",
  "function WARBOW_GUARD_BURN_WAD() view returns (uint256)",
  "function WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD() view returns (uint256)",
  "function WARBOW_FLAG_SILENCE_SEC() view returns (uint256)",
  "function WARBOW_FLAG_CLAIM_BP() view returns (uint256)",
  "function WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY() view returns (uint8)",
  "function SECONDS_PER_DAY() view returns (uint256)",
  "function WARBOW_REVENGE_WINDOW_SEC() view returns (uint256)",
  "function WARBOW_REVENGE_BURN_WAD() view returns (uint256)",
  "function timeCurveBuyRouter() view returns (address)",
  "function owner() view returns (address)",
]);

export const linearCharmPriceReadAbi = parseAbi([
  "function basePriceWad() view returns (uint256)",
  "function dailyIncrementWad() view returns (uint256)",
]);

export const timeCurveWriteAbi = parseAbi([
  "function startSaleAt(uint256 epoch)",
  "function buy(uint256 charmWad)",
  "function buy(uint256 charmWad, bool plantWarBowFlag)",
  "function buy(uint256 charmWad, bytes32 codeHash, bool plantWarBowFlag)",
  "function claimWarBowFlag()",
  "function warbowSteal(address victim, bool payBypassBurn)",
  "function warbowRevenge(address stealer)",
  "function warbowActivateGuard()",
  "function endSale()",
  "function redeemCharms()",
  "function distributePrizes()",
]);

export const referralRegistryReadAbi = parseAbi([
  "function cl8yToken() view returns (address)",
  "function ownerCode(address owner) view returns (bytes32)",
  "function hashCode(string code) view returns (bytes32)",
  "function ownerOfCode(bytes32 codeHash) view returns (address)",
  "function registrationBurnAmount() view returns (uint256)",
]);

export const referralRegistryWriteAbi = parseAbi(["function registerCode(string code)"]);

export const feeRouterReadAbi = parseAbi([
  "function sinks(uint256 i) view returns (address destination, uint16 weightBps)",
]);

export const rabbitTreasuryReadAbi = parseAbi([
  "function currentEpochId() view returns (uint256)",
  "function epochEnd() view returns (uint256)",
  "function totalReserves() view returns (uint256)",
  "function eWad() view returns (uint256)",
  "function reserveAsset() view returns (address)",
  "function paused() view returns (bool)",
  "function doub() view returns (address)",
  // Quote user payout + protocol fee; previewWithdraw uses msg.sender for cooldown, previewWithdrawFor(user) for wallets/RPC sims.
  "function previewWithdraw(uint256 doubAmount) view returns (uint256 userOut, uint256 feeToProtocol)",
  "function previewWithdrawFor(address user, uint256 doubAmount) view returns (uint256 userOut, uint256 feeToProtocol)",
]);

export const rabbitTreasuryWriteAbi = parseAbi([
  "function deposit(uint256 amount, uint256 factionId)",
  "function withdraw(uint256 doubAmount, uint256 factionId)",
]);

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
]);

/** SwapRouter-compatible `exactOutput` (issue #41). */
export const kumbayaSwapRouterAbi = parseAbi([
  "function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) returns (uint256 amountIn)",
]);

/** [`TimeCurveBuyRouter.buyViaKumbaya`](../../contracts/src/TimeCurveBuyRouter.sol) — single-tx ETH / stable → Kumbaya → `buyFor` (issue #65 / #66). */
export const timeCurveBuyRouterAbi = parseAbi([
  "function buyViaKumbaya(uint256 charmWad, bytes32 codeHash, bool plantWarBowFlag, uint8 payKind, uint256 swapDeadline, uint256 amountInMaximum, bytes path) payable",
]);

/** [`DoubPresaleVesting`](../../contracts/src/vesting/DoubPresaleVesting.sol) — presale DOUB cliff + linear vesting (GitLab #92). */
export const doubPresaleVestingReadAbi = parseAbi([
  "function token() view returns (address)",
  "function totalAllocated() view returns (uint256)",
  "function vestingDuration() view returns (uint256)",
  "function vestingStart() view returns (uint256)",
  "function claimsEnabled() view returns (bool)",
  "function allocationOf(address) view returns (uint256)",
  "function claimedOf(address) view returns (uint256)",
  "function claimable(address) view returns (uint256)",
  "function isBeneficiary(address) view returns (bool)",
]);

export const doubPresaleVestingWriteAbi = parseAbi(["function claim()"]);

export const leprechaunReadAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
]);
