// SPDX-License-Identifier: AGPL-3.0-only

import { parseAbi } from "viem";

export const timeCurveReadAbi = parseAbi([
  "function saleStart() view returns (uint256)",
  "function deadline() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function ended() view returns (bool)",
  "function currentMinBuyAmount() view returns (uint256)",
  "function acceptedAsset() view returns (address)",
  "function launchedToken() view returns (address)",
  "function referralRegistry() view returns (address)",
  "function REFERRAL_EACH_BPS() view returns (uint16)",
  "function initialMinBuy() view returns (uint256)",
  "function growthRateWad() view returns (uint256)",
  "function purchaseCapMultiple() view returns (uint256)",
  "function timerExtensionSec() view returns (uint256)",
  "function timerCapSec() view returns (uint256)",
  "function totalTokensForSale() view returns (uint256)",
  "function openingWindowSec() view returns (uint256)",
  "function closingWindowSec() view returns (uint256)",
  "function podium(uint8 category) view returns (address[3] winners, uint256[3] values)",
]);

export const timeCurveWriteAbi = parseAbi([
  "function buy(uint256 amount)",
  "function buy(uint256 amount, bytes32 codeHash)",
  "function endSale()",
  "function claimAllocation()",
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
