// SPDX-License-Identifier: AGPL-3.0-only

import type { BuyItem } from "@/lib/indexerApi";
import { displayMinGrossSpendAtFloat, maxGrossSpendAtFloat } from "@/lib/timeCurveMath";

export type EnvelopeCurveParams = {
  saleStartSec: number;
  charmEnvelopeRefWad: bigint;
  growthRateWad: bigint;
  basePriceWad: bigint;
  dailyIncrementWad: bigint;
};

/**
 * Where `amount` sat as a share of the legal max gross spend at the buy block time.
 * Legal buys therefore map to roughly 0.1..1.0 because the displayed min:max band is 1:10.
 * Requires indexer `block_timestamp` on the buy row.
 */
export function buySpendEnvelopeFillRatio(buy: BuyItem, env: EnvelopeCurveParams): number | null {
  const ts = buy.block_timestamp?.trim();
  if (!ts || env.saleStartSec <= 0) {
    return null;
  }
  let elapsedSec: number;
  try {
    const bt = Number(BigInt(ts));
    elapsedSec = Math.max(0, bt - env.saleStartSec);
  } catch {
    return null;
  }
  const minSpend = displayMinGrossSpendAtFloat(
    env.charmEnvelopeRefWad,
    env.growthRateWad,
    env.basePriceWad,
    env.dailyIncrementWad,
    elapsedSec,
  );
  const maxSpend = maxGrossSpendAtFloat(
    env.charmEnvelopeRefWad,
    env.growthRateWad,
    env.basePriceWad,
    env.dailyIncrementWad,
    elapsedSec,
  );
  const amount = BigInt(buy.amount);
  if (maxSpend <= 0n || maxSpend <= minSpend) {
    return null;
  }
  const minRatio = Number((minSpend * 10_000n) / maxSpend) / 10_000;
  if (amount <= minSpend) {
    return Math.max(0, Math.min(1, minRatio));
  }
  if (amount >= maxSpend) {
    return 1;
  }
  const scaled = Number((amount * 10_000n) / maxSpend) / 10_000;
  return Math.max(minRatio, Math.min(1, scaled));
}

/** Human-readable age from unix block time vs “now” (wall or ledger). */
export function formatBuyAge(blockTimestamp: string | null | undefined, nowUnixSec: number): string | null {
  if (!blockTimestamp?.trim()) {
    return null;
  }
  try {
    const t = Number(BigInt(blockTimestamp.trim()));
    const delta = Math.max(0, Math.floor(nowUnixSec) - t);
    if (delta < 60) {
      return `${delta}s ago`;
    }
    if (delta < 3600) {
      return `${Math.floor(delta / 60)}m ago`;
    }
    if (delta < 86400) {
      return `${Math.floor(delta / 3600)}h ago`;
    }
    return `${Math.floor(delta / 86400)}d ago`;
  } catch {
    return null;
  }
}
