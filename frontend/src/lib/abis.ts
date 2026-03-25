// SPDX-License-Identifier: AGPL-3.0-only

import { parseAbi } from "viem";

export const timeCurveReadAbi = parseAbi([
  "function saleStart() view returns (uint256)",
  "function deadline() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function ended() view returns (bool)",
  "function currentMinBuyAmount() view returns (uint256)",
  "function acceptedAsset() view returns (address)",
]);

export const timeCurveWriteAbi = parseAbi(["function buy(uint256 amount)"]);

export const rabbitTreasuryReadAbi = parseAbi([
  "function currentEpochId() view returns (uint256)",
  "function epochEnd() view returns (uint256)",
  "function totalReserves() view returns (uint256)",
  "function eWad() view returns (uint256)",
  "function reserveAsset() view returns (address)",
  "function paused() view returns (bool)",
]);

export const rabbitTreasuryWriteAbi = parseAbi([
  "function deposit(uint256 amount, uint256 factionId)",
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
  "function tokenTraits(uint256 tokenId) view returns (uint256 seriesId, uint8 rarityTier, uint8 role, uint8 passiveEffectType, uint256 setId, uint8 setPosition, uint8 bonusCategory, uint256 bonusValue, uint256 synergyTag, bool agentTradable, bool agentLendable, bool factionLocked)",
]);
