// SPDX-License-Identifier: AGPL-3.0-only

/**
 * DotMegaDomains (MegaNames) on MegaETH follows the same naming model as
 * [wei-names](https://github.com/z0r0z/wei-names); reverse display uses the
 * deployed registry’s `getName(address)` view (MegaETH mainnet registry below).
 */

import { getAddress, isAddress } from "viem";
import { parseHexAddress, type HexAddress } from "./addresses";
import type {
  BuyItem,
  CharmRedemptionItem,
  PrizePayoutItem,
  ReferralAppliedItem,
  WarbowBattleFeedItem,
  WarbowLeaderboardItem,
} from "./indexerApi";

/** MegaETH mainnet chain id (see official MegaETH docs). */
export const MEGAETH_MAINNET_CHAIN_ID = 4326;

/** MegaNames ERC-721 — canonical DotMega / `.mega` registry on MegaETH mainnet. */
export const DOTMEGA_NAMES_MAINNET: HexAddress =
  "0x5B424C6CCba77b32b9625a6fd5A30D409d20d997";

export const megaNamesReadAbi = [
  {
    inputs: [{ internalType: "address", name: "addr_", type: "address" }],
    name: "getName",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

export function dotMegaRegistryAddress(chainId: number): HexAddress | undefined {
  const fromEnv = parseHexAddress(import.meta.env.VITE_DOTMEGA_REGISTRY_ADDRESS);
  if (fromEnv) {
    return fromEnv;
  }
  if (chainId === MEGAETH_MAINNET_CHAIN_ID) {
    return DOTMEGA_NAMES_MAINNET;
  }
  return undefined;
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

function walkUnknownForAddresses(value: unknown, sink: Set<string>): void {
  if (typeof value === "string") {
    if (ADDR_RE.test(value)) {
      sink.add(value);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      walkUnknownForAddresses(v, sink);
    }
    return;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    walkUnknownForAddresses(v, sink);
  }
}

export type TimecurveDotMegaSourceInput = {
  connected?: string;
  stealVictim?: string;
  stealVictimInput?: string;
  warbowLb: WarbowLeaderboardItem[] | null;
  buys: BuyItem[] | null;
  claims: CharmRedemptionItem[] | null;
  prizePayouts: PrizePayoutItem[] | null;
  refApplied: ReferralAppliedItem[] | null;
  warbowFeed: WarbowBattleFeedItem[] | null;
  /** Each row: three onchain winner addresses per podium category (four categories). */
  podiumRows: readonly { winners: readonly [string, string, string] }[];
  /** Top-3 WarBow ladder wallets from `warbowLadderPodium` when available. */
  warbowPodiumWallets: readonly string[] | undefined;
  pendingRevengeStealer?: string;
};

/** Collect checksummed wallet addresses shown on TimeCurve for DotMega reverse lookups. */
export function collectTimecurveWalletAddressesForDotMega(input: TimecurveDotMegaSourceInput): readonly HexAddress[] {
  const sink = new Set<string>();
  const add = (a?: string | null) => {
    if (!a) {
      return;
    }
    const t = a.trim();
    if (!isAddress(t)) {
      return;
    }
    if (t.toLowerCase() === ZERO) {
      return;
    }
    sink.add(getAddress(t as `0x${string}`));
  };

  add(input.connected);
  add(input.stealVictim);
  const rawInput = input.stealVictimInput?.trim();
  if (rawInput && isAddress(rawInput)) {
    add(rawInput);
  }
  for (const row of input.warbowLb ?? []) {
    add(row.buyer);
  }
  for (const b of input.buys ?? []) {
    add(b.buyer);
  }
  for (const c of input.claims ?? []) {
    add(c.buyer);
  }
  for (const p of input.prizePayouts ?? []) {
    add(p.winner);
  }
  for (const r of input.refApplied ?? []) {
    add(r.buyer);
    add(r.referrer);
  }
  for (const w of input.warbowPodiumWallets ?? []) {
    add(w);
  }
  for (const row of input.podiumRows) {
    for (const w of row.winners) {
      add(w);
    }
  }
  add(input.pendingRevengeStealer);
  for (const item of input.warbowFeed ?? []) {
    walkUnknownForAddresses(item.detail, sink);
  }

  return [...sink] as HexAddress[];
}
