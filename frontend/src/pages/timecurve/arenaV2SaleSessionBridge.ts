// SPDX-License-Identifier: AGPL-3.0-only

import { parseUnits } from "viem";
import { addresses, type HexAddress } from "@/lib/addresses";
import { timeArenaReadAbi } from "@/lib/abis";
import type { ContractReadRow } from "@/pages/timecurve/useTimecurveSaleState";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const CHARM_MIN_WAD = parseUnits("0.99", 18);
const CHARM_MAX_WAD = parseUnits("10", 18);

export function isArenaV2TimeCurve(tc: HexAddress | undefined): boolean {
  const arena = addresses.timeArena;
  if (!tc || !arena) return false;
  return tc.toLowerCase() === arena.toLowerCase();
}

/** Multicall shape aligned with `useTimeCurveSaleSession` core row destructuring. */
export function arenaV2CoreContracts(tc: HexAddress) {
  return [
    { address: tc, abi: timeArenaReadAbi, functionName: "arenaStart" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "deadline" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "paused" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "charmPriceWad" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "doub" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "referralRegistry" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "totalDoubRaised" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "buyCooldownSec" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "timerExtensionSec" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "timerCapSec" as const },
  ] as const;
}

function row(result: unknown): ContractReadRow {
  return { status: "success", result };
}

/** Maps Arena v2 multicall results into TimeCurve-shaped `coreData` rows. */
export function mapArenaV2CoreRows(
  raw: readonly { status: string; result?: unknown }[] | undefined,
): readonly ContractReadRow[] | undefined {
  if (!raw || raw.length < 10) return undefined;
  const ok = (i: number) => raw[i]?.status === "success";
  if (![0, 1, 2, 3, 4].every(ok)) return undefined;

  const saleStart = raw[0]!.result as bigint;
  const deadline = raw[1]!.result as bigint;
  const paused = raw[2]!.result as boolean;
  const priceWad = raw[3]!.result as bigint;
  const doub = raw[4]!.result as HexAddress;
  const referral = ok(5) ? (raw[5]!.result as HexAddress) : ZERO;
  const totalRaised = ok(6) ? (raw[6]!.result as bigint) : 0n;
  const buyCooldown = ok(7) ? (raw[7]!.result as bigint) : 300n;
  const timerExt = ok(8) ? (raw[8]!.result as bigint) : 120n;
  const timerCap = ok(9) ? (raw[9]!.result as bigint) : 86_400n;

  return [
    row(saleStart),
    row(deadline),
    row(paused),
    row(CHARM_MIN_WAD),
    row(CHARM_MAX_WAD),
    row([CHARM_MIN_WAD, CHARM_MAX_WAD]),
    row(priceWad),
    row(doub),
    row(doub),
    row(referral),
    row(totalRaised),
    row(0n),
    row(0n),
    row(CHARM_MIN_WAD),
    row(0n),
    row(timerExt),
    row(timerCap),
    row(buyCooldown),
    row(ZERO),
    row(true),
    row(false),
    row(false),
    row(ZERO),
    row(ZERO),
    row(ZERO),
    row(0n),
    row(0n),
    row(ZERO),
    row(500n),
    row(0n),
    row(ZERO),
  ];
}

export function arenaV2UserContracts(tc: HexAddress, wallet: HexAddress) {
  return [
    { address: tc, abi: timeArenaReadAbi, functionName: "nextBuyAllowedAt" as const, args: [wallet] },
  ] as const;
}

export function mapArenaV2UserRows(
  raw: readonly { status: string; result?: unknown }[] | undefined,
): readonly ContractReadRow[] | undefined {
  if (!raw?.[0] || raw[0].status !== "success") return undefined;
  const nextBuy = raw[0].result as bigint;
  return [row(0n), row(false), row(nextBuy), row(0n)];
}
