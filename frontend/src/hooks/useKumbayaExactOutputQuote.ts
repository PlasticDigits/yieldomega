// SPDX-License-Identifier: AGPL-3.0-only

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import type { HexAddress } from "@/lib/addresses";
import {
  quoteKumbayaArenaExactOutputAmountIn,
  quoteKumbayaExactOutputAmountIn,
} from "@/lib/kumbayaQuoter";
import type { KumbayaChainConfigResolved, PayWithAsset } from "@/lib/kumbayaRoutes";

/** Live quoter read for Kumbaya `exactOutput` via `quoteExactOutputSingle` hops (bytes path reverts on MegaETH). */
export function useKumbayaExactOutputQuote(params: {
  enabled: boolean;
  payWith: PayWithAsset;
  kConfig: KumbayaChainConfigResolved | undefined;
  acceptedCl8y: HexAddress | undefined;
  amountOut: bigint | undefined;
  /** When `doub`, quotes ETH/USDM → DOUB hops for TimeArena buy router (#264). */
  swapOutToken?: "cl8y" | "doub";
}) {
  const wagmiConfig = useConfig();
  const { enabled, payWith, kConfig, acceptedCl8y, amountOut, swapOutToken = "cl8y" } = params;
  const quoter = kConfig?.quoter;
  const canRun =
    enabled &&
    payWith !== "cl8y" &&
    quoter !== undefined &&
    kConfig !== undefined &&
    acceptedCl8y !== undefined &&
    amountOut !== undefined &&
    amountOut > 0n;

  return useQuery({
    queryKey: [
      "kumbayaExactOutputQuote",
      payWith,
      quoter,
      amountOut?.toString(),
      kConfig?.cl8yWethFee,
      kConfig?.usdmWethFee,
      acceptedCl8y,
      swapOutToken,
    ],
    queryFn: () =>
      swapOutToken === "doub"
        ? quoteKumbayaArenaExactOutputAmountIn(wagmiConfig, {
            quoter: quoter!,
            kConfig: kConfig!,
            payWith: payWith as Exclude<PayWithAsset, "cl8y">,
            doubAddress: acceptedCl8y!,
            amountOut: amountOut!,
          })
        : quoteKumbayaExactOutputAmountIn(wagmiConfig, {
            quoter: quoter!,
            kConfig: kConfig!,
            payWith: payWith as Exclude<PayWithAsset, "cl8y">,
            acceptedCl8y: acceptedCl8y!,
            amountOut: amountOut!,
          }),
    enabled: canRun,
    placeholderData: keepPreviousData,
  });
}
