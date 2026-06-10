// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits, isAddress, zeroAddress } from "viem";
import { FEATURE_UNLOCK_LEVEL } from "@/lib/arenaProgression";
import type { ArenaWalletStats, BuyItem } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { hasPodiumWinner } from "@/pages/arena/arenaSimplePodiumRanking";
export { formatPodiumLeaderboardValue } from "@/pages/arena/podiumFormat";

/** Copy level for side-rail Last Buy / wallet surfaces before the first indexed buy. */
export const ARENA_LAST_BUY_WALLET_LOCK_LEVEL = FEATURE_UNLOCK_LEVEL.last_buy;

export type ArenaUsersSource = {
  recentBuys?: readonly BuyItem[] | null;
  podiumRows?: readonly { winners?: readonly string[] }[] | null;
};

export function walletHasArenaBuy(stats: ArenaWalletStats | null | undefined): boolean {
  if (!stats) return false;
  if (stats.buy_count > 0) return true;
  return stats.first_buy_at !== null && stats.first_buy_at !== "";
}

export function arenaHasUsers(source: ArenaUsersSource): boolean {
  if ((source.recentBuys?.length ?? 0) > 0) return true;
  for (const row of source.podiumRows ?? []) {
    for (const winner of row.winners ?? []) {
      if (hasPodiumWinner(winner)) return true;
    }
  }
  return false;
}

/** Unlocks wallet + Last Buy side-rail surfaces after arena activity and a wallet buy. */
export function isArenaLastBuyWalletSurfaceUnlocked(opts: {
  walletConnected: boolean;
  walletStats: ArenaWalletStats | null | undefined;
  arenaUsers: ArenaUsersSource;
}): boolean {
  if (!arenaHasUsers(opts.arenaUsers)) return false;
  if (!opts.walletConnected) return false;
  return walletHasArenaBuy(opts.walletStats);
}

/** UX podium row index for WarBow BP leaders (matches `ArenaSimplePage` `WARBOW_PODIUM_SLOT`). */
export const WARBOW_PODIUM_UX_SLOT = 1 as const;

export type IndexerWarbowViewerBpSource = {
  recentBuys?: readonly BuyItem[] | null;
  podiumRows?: readonly { winners: readonly string[]; values: readonly string[] }[] | undefined;
  /** Wallet stats `warbow_battle_points` when indexer is configured (#301). */
  walletWarbowBattlePoints?: string;
};

export function parseNonNegativeUnixSec(raw: string | undefined): bigint | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  try {
    const value = BigInt(trimmed);
    return value < 0n ? undefined : value;
  } catch {
    return undefined;
  }
}

function parseNonNegativeBp(raw: string | undefined): bigint | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  try {
    const value = BigInt(trimmed);
    return value < 0n ? undefined : value;
  } catch {
    return undefined;
  }
}

/**
 * Viewer WarBow BP for display — wallet stats, indexer buys (newest first), then WarBow podium row ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)).
 */
export function resolveIndexerViewerWarbowBattlePoints(
  viewerAddress: string | undefined,
  source: IndexerWarbowViewerBpSource,
): bigint | undefined {
  const viewer = viewerAddress?.trim().toLowerCase();
  if (!viewer || !isAddress(viewer as `0x${string}`)) return undefined;

  for (const buy of source.recentBuys ?? []) {
    if (buy.buyer?.toLowerCase() !== viewer) continue;
    const bp = parseNonNegativeBp(buy.battle_points_after);
    if (bp !== undefined) return bp;
  }

  const walletBp = parseNonNegativeBp(source.walletWarbowBattlePoints);
  if (walletBp !== undefined) return walletBp;

  const warbowRow = source.podiumRows?.[WARBOW_PODIUM_UX_SLOT];
  const winners = warbowRow?.winners ?? [];
  const values = warbowRow?.values ?? [];
  for (let i = 0; i < winners.length; i += 1) {
    const winner = winners[i]?.trim();
    if (
      !winner ||
      !isAddress(winner as `0x${string}`) ||
      winner.toLowerCase() === zeroAddress ||
      winner.toLowerCase() !== viewer
    ) {
      continue;
    }
    const bp = parseNonNegativeBp(values[i]);
    if (bp !== undefined) return bp;
  }

  return undefined;
}

/** Arena “YOUR BP” line: locale-grouped integer, rounded to this many significant figures. */
export const WARBOW_VIEWER_BP_DISPLAY_SIGFIGS = 5 as const;

/**
 * Round a non-negative integer toward the nearest representable value at `sigfigs`
 * significant decimal digits (half-up on the first dropped digit).
 */
export function roundNonNegativeBigIntToSignificantDigits(value: bigint, sigfigs: number): bigint {
  if (value < 0n) {
    throw new RangeError("roundNonNegativeBigIntToSignificantDigits: expected non-negative");
  }
  if (value === 0n) {
    return 0n;
  }
  const sf = Math.max(1, Math.floor(sigfigs));
  const str = value.toString();
  const d = str.length;
  if (d <= sf) {
    return value;
  }
  const coefStr = str.slice(0, sf);
  const nextCh = str[sf] ?? "0";
  let coef = BigInt(coefStr);
  if (nextCh >= "5") {
    coef += 1n;
  }
  const exp = d - sf;
  return coef * 10n ** BigInt(exp);
}

/** Human BP label for the WarBow hero summary (comma groups; `undefined` while loading / absent). */
export function formatWarbowViewerBattlePointsDisplay(
  battlePoints: bigint | undefined,
  sigfigs: number = WARBOW_VIEWER_BP_DISPLAY_SIGFIGS,
): string {
  if (battlePoints === undefined) {
    return "—";
  }
  const rounded = roundNonNegativeBigIntToSignificantDigits(battlePoints, sigfigs);
  return formatLocaleInteger(rounded);
}

/** Placeholder **USD** rate for Arena total-raise display only (1 CL8Y = 1 USD); not an oracle. [GitLab #192](https://gitlab.com/PlasticDigits/yieldomega/-/issues/192). */
export const CL8Y_USD_PRICE_PLACEHOLDER = 1;

/** Same human strings as the former Arena `timer-hero` TOTAL RAISE / TOTAL USD lines (onchain `totalRaised` wei). */
export function formatTotalRaiseHeroDisplayFromWei(
  rawWei: bigint,
  decimals: number,
): { cl8y: string; usd: string } {
  const human = Number(formatUnits(rawWei, decimals));
  if (!Number.isFinite(human)) {
    return { cl8y: "—", usd: "—" };
  }
  const cl8y = human.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const usd = (human * CL8Y_USD_PRICE_PLACEHOLDER).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  return { cl8y, usd };
}

export function compareBuysNewestFirst(a: BuyItem, b: BuyItem): number {
  try {
    const blockA = BigInt(a.block_number);
    const blockB = BigInt(b.block_number);
    if (blockA !== blockB) {
      return blockA > blockB ? -1 : 1;
    }
  } catch {
    const blockA = Number(a.block_number);
    const blockB = Number(b.block_number);
    if (Number.isFinite(blockA) && Number.isFinite(blockB) && blockA !== blockB) {
      return blockB - blockA;
    }
  }
  return b.log_index - a.log_index;
}

export function clampBigint(x: bigint, lo: bigint, hi: bigint): bigint {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

export function mergeBuysNewestFirst(
  incoming: BuyItem[],
  existing: BuyItem[] | null | undefined,
): BuyItem[] {
  const merged = new Map<string, BuyItem>();
  for (const buy of [...incoming, ...(existing ?? [])]) {
    merged.set(`${buy.tx_hash}-${buy.log_index}`, buy);
  }
  return Array.from(merged.values()).sort(compareBuysNewestFirst);
}

export function describeBurstBand(ratio: number | null): string {
  if (ratio === null) {
    return "Size color waiting for indexed block time";
  }
  if (ratio <= 0.12) {
    return "Blue = near min band";
  }
  if (ratio <= 0.25) {
    return "Green = lighter buy";
  }
  if (ratio <= 0.5) {
    return "Yellow = mid-band buy";
  }
  if (ratio <= 0.75) {
    return "Orange = heavier buy";
  }
  return "Red = near max band";
}

export type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};
