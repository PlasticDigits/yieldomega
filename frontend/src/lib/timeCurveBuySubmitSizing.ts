// SPDX-License-Identifier: AGPL-3.0-only
//
// Submit-time CHARM sizing: live `currentCharmBoundsWad` / price can move between
// slider quote and tx landing ([GitLab #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)).

import type { Config } from "wagmi";
import { readContract } from "wagmi/actions";
import { timeCurveReadAbi } from "@/lib/abis";
import { finalizeCharmSpendForBuy } from "@/lib/timeCurveBuyAmount";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeCurveMinSpendHeadroom";

/**
 * Headroom **below** onchain `maxCharmWad` (bps of max removed) so a buy that
 * passes simulation is less likely to revert when the envelope tightens one
 * block later. 50 bps → use at most **99.5%** of the live max.
 */
export const CHARM_SUBMIT_UPPER_SLACK_BPS = 50n;

/**
 * Headroom **above** onchain `minCharmWad` so a buy sized at the lower edge is
 * less likely to revert when **min** rises between submit and inclusion (same
 * multi-block drift window as the upper slack — [GitLab #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)).
 * 50 bps → effective floor **100.5%** of the live min (integer division).
 */
export const CHARM_SUBMIT_LOWER_HEADROOM_BPS = 50n;

export function effectiveMaxCharmWadForSubmit(maxCharmWad: bigint): bigint {
  if (maxCharmWad <= 0n) return 0n;
  return (maxCharmWad * (10000n - CHARM_SUBMIT_UPPER_SLACK_BPS)) / 10000n;
}

export function effectiveMinCharmWadForSubmit(minCharmWad: bigint): bigint {
  if (minCharmWad <= 0n) return 0n;
  return (minCharmWad * (10000n + CHARM_SUBMIT_LOWER_HEADROOM_BPS)) / 10000n;
}

function clampBigint(x: bigint, lo: bigint, hi: bigint): bigint {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

export type FreshBuySizingResult =
  | { ok: true; charmWad: bigint; spendWei: bigint; pricePerCharmWad: bigint }
  | { ok: false; message: string };

/** Pure sizing from fresh RPC-shaped values (unit-tested). */
export function reconcileFreshBuySizingFromReads(input: {
  spendWeiIntent: bigint;
  minSpendWei: bigint;
  maxSpendWei: bigint;
  pricePerCharmWad: bigint;
  minCharmWad: bigint;
  maxCharmWad: bigint;
}): FreshBuySizingResult {
  const {
    spendWeiIntent,
    minSpendWei,
    maxSpendWei,
    pricePerCharmWad,
    minCharmWad,
    maxCharmWad,
  } = input;
  if (pricePerCharmWad <= 0n) {
    return { ok: false, message: "Onchain per-CHARM price is zero; wait for contract state." };
  }
  if (minSpendWei > maxSpendWei) {
    return { ok: false, message: "CL8Y spend band is empty for this wallet and curve state." };
  }
  const sw = clampBigint(spendWeiIntent, minSpendWei, maxSpendWei);
  const maxCharmEff = effectiveMaxCharmWadForSubmit(maxCharmWad);
  const minCharmEff = effectiveMinCharmWadForSubmit(minCharmWad);
  if (maxCharmEff < minCharmEff) {
    return {
      ok: false,
      message:
        "Live CHARM min–max band is too tight after safety margins; wait a block or adjust the amount.",
    };
  }
  try {
    const { charmWad, spendWei } = finalizeCharmSpendForBuy(
      sw,
      pricePerCharmWad,
      minCharmEff,
      maxCharmEff,
    );
    if (charmWad <= 0n || spendWei <= 0n) {
      return { ok: false, message: "Computed buy size is zero; adjust the CL8Y amount." };
    }
    return { ok: true, charmWad, spendWei, pricePerCharmWad };
  } catch {
    return { ok: false, message: "Could not size CHARM from the live price and bounds." };
  }
}

/**
 * Re-read min/max CL8Y spend, CHARM bounds, and price, then derive **`charmWad`**
 * and matching gross CL8Y **`spendWei`** (floored like onchain `mulDiv`) for
 * **`buy` / `buyViaKumbaya`**. Call immediately before building calldata.
 */
export async function readFreshTimeCurveBuySizing(params: {
  wagmiConfig: Config;
  timeCurveAddress: `0x${string}`;
  spendWeiIntent: bigint;
  /** CL8Y direct pay: cap max spend by wallet CL8Y balance. Omit for ETH/USDM. */
  walletCl8yCapWei?: bigint;
}): Promise<FreshBuySizingResult> {
  const { wagmiConfig, timeCurveAddress, spendWeiIntent, walletCl8yCapWei } = params;

  const [bounds, price, minBuy, maxBuy] = await Promise.all([
    readContract(wagmiConfig, {
      address: timeCurveAddress,
      abi: timeCurveReadAbi,
      functionName: "currentCharmBoundsWad",
    }) as Promise<readonly [bigint, bigint]>,
    readContract(wagmiConfig, {
      address: timeCurveAddress,
      abi: timeCurveReadAbi,
      functionName: "currentPricePerCharmWad",
    }) as Promise<bigint>,
    readContract(wagmiConfig, {
      address: timeCurveAddress,
      abi: timeCurveReadAbi,
      functionName: "currentMinBuyAmount",
    }) as Promise<bigint>,
    readContract(wagmiConfig, {
      address: timeCurveAddress,
      abi: timeCurveReadAbi,
      functionName: "currentMaxBuyAmount",
    }) as Promise<bigint>,
  ]);

  const [minC, maxC] = bounds;
  const minS = minCl8ySpendBroadcastHeadroom(minBuy);
  let maxS = maxBuy;
  if (walletCl8yCapWei !== undefined) {
    const b = walletCl8yCapWei;
    if (b < maxS) maxS = b;
  }

  return reconcileFreshBuySizingFromReads({
    spendWeiIntent,
    minSpendWei: minS,
    maxSpendWei: maxS,
    pricePerCharmWad: price,
    minCharmWad: minC,
    maxCharmWad: maxC,
  });
}
