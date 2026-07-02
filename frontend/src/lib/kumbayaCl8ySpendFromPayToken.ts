// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import type { HexAddress } from "@/lib/addresses";
import { quoteKumbayaArenaExactOutputAmountIn, quoteKumbayaExactOutputAmountIn } from "@/lib/kumbayaQuoter";
import type { KumbayaChainConfigResolved, PayWithAsset } from "@/lib/kumbayaRoutes";

const MAX_BINARY_SEARCH_STEPS = 48;

/**
 * Largest CL8Y spend in `[minSpendWei, maxSpendWei]` whose Kumbaya quote is ≤ `targetPayInWei`.
 * Quotes are monotonic in `amountOut` for a fixed path.
 */
export async function cl8ySpendWeiFromPayTokenBudget(
  wagmiConfig: Config,
  params: {
    quoter: HexAddress;
    kConfig: KumbayaChainConfigResolved;
    payWith: Exclude<PayWithAsset, "doub" | "cred">;
    acceptedCl8y: HexAddress;
    targetPayInWei: bigint;
    minSpendWei: bigint;
    maxSpendWei: bigint;
    swapOutToken?: "cl8y" | "doub";
  },
): Promise<bigint> {
  const {
    targetPayInWei,
    minSpendWei,
    maxSpendWei,
    quoter,
    kConfig,
    payWith,
    acceptedCl8y,
    swapOutToken = "cl8y",
  } = params;
  if (maxSpendWei <= minSpendWei) return minSpendWei;
  if (targetPayInWei <= 0n) return minSpendWei;

  const quoteAt = (amountOut: bigint) =>
    swapOutToken === "doub"
      ? quoteKumbayaArenaExactOutputAmountIn(wagmiConfig, {
          quoter,
          kConfig,
          payWith,
          doubAddress: acceptedCl8y,
          amountOut,
        })
      : quoteKumbayaExactOutputAmountIn(wagmiConfig, {
          quoter,
          kConfig,
          payWith: payWith as Exclude<PayWithAsset, "cl8y" | "doub" | "cred">,
          acceptedCl8y,
          amountOut,
        });

  const qMin = await quoteAt(minSpendWei);
  if (qMin >= targetPayInWei) return minSpendWei;
  const qMax = await quoteAt(maxSpendWei);
  if (qMax <= targetPayInWei) return maxSpendWei;

  let lo = minSpendWei;
  let hi = maxSpendWei;
  for (let i = 0; i < MAX_BINARY_SEARCH_STEPS && lo < hi; i++) {
    const mid = lo + (hi - lo + 1n) / 2n;
    const q = await quoteAt(mid);
    if (q <= targetPayInWei) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

/** Static inverse when the quoter is unavailable (matches `fallbackPayTokenWeiForCl8y`). */
export function cl8ySpendWeiFromPayTokenFallback(
  targetPayInWei: bigint,
  payWith: "eth" | "usdm",
  minSpendWei: bigint,
  maxSpendWei: bigint,
): bigint {
  if (targetPayInWei <= 0n) return minSpendWei;
  let spend: bigint;
  if (payWith === "usdm") {
    spend = (targetPayInWei * 100n) / 98n;
  } else {
    spend = (targetPayInWei * 1_000_000n) / 419n;
  }
  if (spend < minSpendWei) return minSpendWei;
  if (spend > maxSpendWei) return maxSpendWei;
  return spend;
}
