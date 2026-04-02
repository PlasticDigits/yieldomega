// SPDX-License-Identifier: AGPL-3.0-only

import { parseAbi } from "viem";

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
  "function launchedToken() view returns (address)",
  "function referralRegistry() view returns (address)",
  "function REFERRAL_EACH_BPS() view returns (uint16)",
  "function initialMinBuy() view returns (uint256)",
  "function growthRateWad() view returns (uint256)",
  "function timerExtensionSec() view returns (uint256)",
  "function initialTimerSec() view returns (uint256)",
  "function timerCapSec() view returns (uint256)",
  "function totalTokensForSale() view returns (uint256)",
  "function feeRouter() view returns (address)",
  "function podiumPool() view returns (address)",
  "function totalCharmWeight() view returns (uint256)",
  "function podium(uint8 category) view returns (address[3] winners, uint256[3] values)",
  "function charmWeight(address user) view returns (uint256)",
  "function buyCount(address user) view returns (uint256)",
  "function charmsRedeemed(address user) view returns (bool)",
  "function totalEffectiveTimerSecAdded(address user) view returns (uint256)",
  "function activityPoints(address user) view returns (uint256)",
  "function activeDefendedStreak(address user) view returns (uint256)",
  "function bestDefendedStreak(address user) view returns (uint256)",
  "function ACTIVITY_POINTS_PER_BUY() view returns (uint256)",
  "function ACTIVITY_ATTACK_BURN_WAD() view returns (uint256)",
  "function ACTIVITY_ATTACK_DRAIN_BPS() view returns (uint16)",
  "function CAT_LAST_BUYERS() view returns (uint8)",
  "function CAT_TIME_BOOSTER() view returns (uint8)",
  "function CAT_ACTIVITY_LEADER() view returns (uint8)",
  "function CAT_DEFENDED_STREAK() view returns (uint8)",
  "function DEFENDED_STREAK_WINDOW_SEC() view returns (uint256)",
  "function prizesDistributed() view returns (bool)",
]);

export const linearCharmPriceReadAbi = parseAbi([
  "function basePriceWad() view returns (uint256)",
  "function dailyIncrementWad() view returns (uint256)",
]);

export const timeCurveWriteAbi = parseAbi([
  "function buy(uint256 charmWad)",
  "function buy(uint256 charmWad, bytes32 codeHash)",
  "function buy(uint256 charmWad, bool activityAttack)",
  "function buy(uint256 charmWad, bytes32 codeHash, bool activityAttack)",
  "function endSale()",
  "function redeemCharms()",
  "function distributePrizes()",
]);

export const referralRegistryReadAbi = parseAbi([
  "function cl8yToken() view returns (address)",
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

export const leprechaunReadAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function tokenTraits(uint256 tokenId) view returns (uint256 seriesId, uint8 rarityTier, uint8 role, uint8 passiveEffectType, uint256 setId, uint8 setPosition, uint8 bonusCategory, uint256 bonusValue, uint256 synergyTag, bool agentTradable, bool agentLendable, bool factionLocked)",
]);
