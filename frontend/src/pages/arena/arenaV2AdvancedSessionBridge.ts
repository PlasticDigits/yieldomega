// SPDX-License-Identifier: AGPL-3.0-only
//
// Maps TimeArena multicall reads into Advanced Arena (`useArenaModel`) row shapes.

import type { HexAddress } from "@/lib/addresses";
import { addresses } from "@/lib/addresses";
import { ARENA_CHARM_MAX_WAD, ARENA_CHARM_MIN_WAD } from "@/lib/arenaConstants";
import { timeArenaReadAbi } from "@/lib/abis";
import type { ContractReadRow } from "@/pages/arena/useArenaSaleState";
import { isTimeArenaV2 } from "@/pages/arena/arenaV2SaleSessionBridge";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const CHARM_MIN_WAD = ARENA_CHARM_MIN_WAD;
const CHARM_MAX_WAD = ARENA_CHARM_MAX_WAD;
const CAT_WARBOW = 3;

function row(result: unknown): ContractReadRow {
  return { status: "success", result };
}

export { isTimeArenaV2 };

/** Core session reads for `/arena/arena` when `tc` is TimeArena (27 rows). */
export function arenaV2AdvancedCoreContracts(tc: HexAddress) {
  return [
    { address: tc, abi: timeArenaReadAbi, functionName: "arenaStart" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "deadline" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "totalDoubRaised" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "paused" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "charmPriceWad" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "doub" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "referralRegistry" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "timerExtensionSec" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "timerCapSec" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "buyCooldownSec" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "timeArenaBuyRouter" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "owner" as const },
  ] as const;
}

export function arenaV2AdvancedWarbowContracts(tc: HexAddress) {
  return [
    { address: tc, abi: timeArenaReadAbi, functionName: "warbowPendingFlagOwner" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "warbowPendingFlagPlantAt" as const },
    {
      address: tc,
      abi: timeArenaReadAbi,
      functionName: "podium" as const,
      args: [CAT_WARBOW] as const,
    },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_STEAL_DOUB" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_GUARD_DOUB" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_STEAL_LIMIT_BYPASS_DOUB" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_FLAG_SILENCE_SEC" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_FLAG_CLAIM_BP" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_MAX_STEALS_PER_DAY" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "SECONDS_PER_DAY" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_REVENGE_WINDOW_SEC" as const },
    { address: tc, abi: timeArenaReadAbi, functionName: "WARBOW_REVENGE_DOUB" as const },
  ] as const;
}

export function mapArenaV2AdvancedCoreRows(
  raw: readonly { status: string; result?: unknown }[] | undefined,
): readonly ContractReadRow[] | undefined {
  if (!raw || raw.length < 12) return undefined;
  const ok = (i: number) => raw[i]?.status === "success";
  if (![0, 1, 2, 3, 4, 5].every(ok)) return undefined;

  const saleStart = raw[0]!.result as bigint;
  const deadline = raw[1]!.result as bigint;
  const totalRaised = raw[2]!.result as bigint;
  const paused = raw[3]!.result as boolean;
  const priceWad = raw[4]!.result as bigint;
  const doub = raw[5]!.result as HexAddress;
  const referral = ok(6) ? (raw[6]!.result as HexAddress) : ZERO;
  const timerExt = ok(7) ? (raw[7]!.result as bigint) : 120n;
  const timerCap = ok(8) ? (raw[8]!.result as bigint) : 86_400n;
  const buyCooldown = ok(9) ? (raw[9]!.result as bigint) : 300n;
  const buyRouter = ok(10) ? (raw[10]!.result as HexAddress) : ZERO;
  const owner = ok(11) ? (raw[11]!.result as HexAddress) : ZERO;
  const podiumVaults = addresses.podiumVaults ?? ZERO;

  return [
    row(saleStart),
    row(deadline),
    row(totalRaised),
    row(false),
    row(CHARM_MIN_WAD),
    row(CHARM_MAX_WAD),
    row([CHARM_MIN_WAD, CHARM_MAX_WAD]),
    row(priceWad),
    row(doub),
    row(doub),
    row(referral),
    row(0n),
    row(0n),
    row(timerExt),
    row(0n),
    row(timerCap),
    row(0n),
    row(ZERO),
    row(false),
    row(!paused),
    row(ZERO),
    row(podiumVaults),
    row(0n),
    row(buyCooldown),
    row(buyRouter),
    row(true),
    row(owner),
  ];
}

export function mapArenaV2AdvancedWarbowRows(
  raw: readonly { status: string; result?: unknown }[] | undefined,
): readonly ContractReadRow[] | undefined {
  if (!raw || raw.length < 12) return undefined;
  const ok = (i: number) => raw[i]?.status === "success";
  if (!ok(0) || !ok(1)) return undefined;

  const ladder = ok(2) ? (raw[2]!.result as readonly [HexAddress[], bigint[]]) : undefined;
  const ladderPodium =
    ladder !== undefined
      ? ([ladder[0], ladder[1]] as const)
      : ([[ZERO, ZERO, ZERO], [0n, 0n, 0n]] as const);

  return [
    row(raw[0]!.result),
    row(raw[1]!.result),
    row(ladderPodium),
    row(ok(3) ? raw[3]!.result : 1000e18),
    row(ok(4) ? raw[4]!.result : 10_000e18),
    row(ok(5) ? raw[5]!.result : 50_000e18),
    row(ok(6) ? raw[6]!.result : 300n),
    row(ok(7) ? raw[7]!.result : 1000n),
    row(ok(8) ? raw[8]!.result : 3),
    row(ok(9) ? raw[9]!.result : 86_400n),
    row(ok(10) ? raw[10]!.result : 86_400n),
    row(ok(11) ? raw[11]!.result : 1000e18),
    row(false),
  ];
}
