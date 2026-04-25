// SPDX-License-Identifier: AGPL-3.0-only

import { formatLocaleInteger } from "@/lib/formatAmount";
import type { BuyItem } from "@/lib/indexerApi";

export const CL8Y_USD_PRICE_PLACEHOLDER = 1;

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

/** `categoryIndex` follows {@link PODIUM_LABELS} order: 0 Last Buy, 1 WarBow, 2 Defended, 3 Time Booster. */
export function formatPodiumLeaderboardValue(categoryIndex: number, raw: string): string {
  const bi = BigInt(raw);
  if (categoryIndex === 3) {
    return `${formatLocaleInteger(bi)} s`;
  }
  if (categoryIndex === 1) {
    return `${formatLocaleInteger(bi)} BP`;
  }
  return formatLocaleInteger(bi);
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
