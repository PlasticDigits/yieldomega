// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import type {
  ArenaPodiumApiRow,
  ArenaSaleState,
  ArenaTimersResponse,
  ArenaWalletStats,
} from "@/lib/indexerApi";
import {
  mapArenaV2AdvancedCoreRows,
  mapArenaV2AdvancedWarbowRows,
} from "@/pages/arena/arenaV2AdvancedSessionBridge";
import type { ContractReadRow } from "@/pages/arena/useArenaSaleState";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const CAT_WARBOW = 3;

function successRow(result: unknown): ContractReadRow {
  return { status: "success", result };
}

function failRow(): ContractReadRow {
  return { status: "failure" };
}

function parseBigIntDecimal(raw: string | undefined): bigint | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

/** Maps `GET /v1/arena/timers` into protocol accordion core rows (no browser RPC). */
export function mapArenaV2AdvancedCoreRowsFromArenaTimers(
  t: ArenaTimersResponse,
): readonly ContractReadRow[] | undefined {
  const price = parseBigIntDecimal(t.charm_price_wad);
  const doub = t.doub;
  if (price === undefined || !doub?.startsWith("0x")) {
    return undefined;
  }

  const raw = [
    { status: "success" as const, result: BigInt(t.arena_start_sec) },
    { status: "success" as const, result: BigInt(t.last_buy_deadline_sec) },
    { status: "success" as const, result: BigInt(t.total_doub_raised) },
    { status: "success" as const, result: t.paused },
    { status: "success" as const, result: price },
    { status: "success" as const, result: doub as HexAddress },
    {
      status: "success" as const,
      result: (t.referral_registry ?? ZERO) as HexAddress,
    },
    {
      status: "success" as const,
      result: BigInt(t.timer_extension_sec ?? "120"),
    },
    { status: "success" as const, result: BigInt(t.timer_cap_sec) },
    {
      status: "success" as const,
      result: BigInt(t.buy_cooldown_sec ?? t.burst_buy_cooldown_sec ?? "300"),
    },
    {
      status: "success" as const,
      result: (t.time_arena_buy_router ?? ZERO) as HexAddress,
    },
    { status: "success" as const, result: ZERO as HexAddress },
  ];

  return mapArenaV2AdvancedCoreRows(raw);
}

function warbowLadderFromPodiumRow(
  row: ArenaPodiumApiRow | undefined,
): readonly [HexAddress, HexAddress, HexAddress, bigint, bigint, bigint] | undefined {
  if (!row?.winners || !row.values || row.winners.length < 3 || row.values.length < 3) {
    return undefined;
  }
  const padAddr = (w: string): HexAddress => {
    const t = w.trim();
    if (!t || t === "0x") {
      return ZERO;
    }
    return t as HexAddress;
  };
  const padVal = (v: string): bigint => parseBigIntDecimal(v) ?? 0n;
  return [
    padAddr(row.winners[0]!),
    padAddr(row.winners[1]!),
    padAddr(row.winners[2]!),
    padVal(row.values[0]!),
    padVal(row.values[1]!),
    padVal(row.values[2]!),
  ] as const;
}

/**
 * WarBow accordion rows from legacy sale-state + indexed podium leaders ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)).
 * On-chain policy constants omitted until indexer exposes them — show failure rows, not browser RPC.
 */
export function mapArenaV2AdvancedWarbowRowsFromSaleState(
  s: ArenaSaleState,
  warbowPodium?: ArenaPodiumApiRow,
): readonly ContractReadRow[] | undefined {
  const addr = (v: string) => v as HexAddress;
  const ladder = warbowLadderFromPodiumRow(warbowPodium);
  const ladderPodium =
    ladder !== undefined
      ? ([[ladder[0], ladder[1], ladder[2]], [ladder[3], ladder[4], ladder[5]]] as const)
      : ([[ZERO, ZERO, ZERO], [0n, 0n, 0n]] as const);

  const rpcShaped = [
    { status: "success" as const, result: addr(s.warbow_pending_flag_owner) },
    { status: "success" as const, result: BigInt(s.warbow_pending_flag_plant_at) },
    { status: "success" as const, result: ladderPodium },
    failRow(),
    failRow(),
    failRow(),
    { status: "success" as const, result: BigInt(s.warbow_flag_silence_sec) },
    { status: "success" as const, result: BigInt(s.warbow_flag_claim_bp) },
    failRow(),
    failRow(),
    failRow(),
    failRow(),
  ];

  return mapArenaV2AdvancedWarbowRows(rpcShaped);
}

/** Connected-wallet sale accordion rows from `GET /v1/arena/wallet/{address}/stats`. */
export function userSaleRowsFromWalletStats(
  stats: ArenaWalletStats | undefined,
): readonly ContractReadRow[] | undefined {
  if (!stats) {
    return undefined;
  }
  const bp = parseBigIntDecimal(stats.warbow_battle_points);
  const guard = parseBigIntDecimal(stats.warbow_guard_until);
  const charm = parseBigIntDecimal(stats.epoch_charm_wad);
  const bestStreak = parseBigIntDecimal(stats.longest_defended_streak);

  return [
    bp !== undefined ? successRow(bp) : failRow(),
    guard !== undefined ? successRow(guard) : successRow(0n),
    charm !== undefined ? successRow(charm) : failRow(),
    successRow(BigInt(stats.buy_count)),
    failRow(),
    failRow(),
    bestStreak !== undefined ? successRow(bestStreak) : successRow(0n),
  ];
}

export function warbowPodiumRowFromIndexerRows(
  rows: readonly ArenaPodiumApiRow[],
): ArenaPodiumApiRow | undefined {
  return rows.find((row) => row.category_index === CAT_WARBOW);
}

export function acceptedDoubFromTimers(t: ArenaTimersResponse | undefined): HexAddress | undefined {
  const doub = t?.doub?.trim();
  if (!doub || !doub.startsWith("0x") || doub.length !== 42 || doub.toLowerCase() === ZERO) {
    return undefined;
  }
  return doub as HexAddress;
}
