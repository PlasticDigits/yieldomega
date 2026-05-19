// SPDX-License-Identifier: AGPL-3.0-only

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import type { HexAddress } from "@/lib/addresses";
import { quoteKumbayaExactOutputAmountIn } from "@/lib/kumbayaQuoter";
import type { KumbayaChainConfigResolved, PayWithAsset } from "@/lib/kumbayaRoutes";

/** Live quoter read for Kumbaya `exactOutput` (ETH bytes path; USDM composite singles). */
export function useKumbayaExactOutputQuote(params: {
  enabled: boolean;
  payWith: PayWithAsset;
  kConfig: KumbayaChainConfigResolved | undefined;
  acceptedCl8y: HexAddress | undefined;
  path: `0x${string}` | undefined;
  amountOut: bigint | undefined;
}) {
  const wagmiConfig = useConfig();
  const { enabled, payWith, kConfig, acceptedCl8y, path, amountOut } = params;
  const quoter = kConfig?.quoter;
  const canRun =
    enabled &&
    payWith !== "cl8y" &&
    quoter !== undefined &&
    kConfig !== undefined &&
    acceptedCl8y !== undefined &&
    path !== undefined &&
    amountOut !== undefined &&
    amountOut > 0n;

  return useQuery({
    queryKey: [
      "kumbayaExactOutputQuote",
      payWith,
      quoter,
      path,
      amountOut?.toString(),
      kConfig?.cl8yWethFee,
      kConfig?.usdmWethFee,
      acceptedCl8y,
    ],
    queryFn: () =>
      quoteKumbayaExactOutputAmountIn(wagmiConfig, {
        quoter: quoter!,
        kConfig: kConfig!,
        payWith: payWith as Exclude<PayWithAsset, "cl8y">,
        acceptedCl8y: acceptedCl8y!,
        path: path!,
        amountOut: amountOut!,
      }),
    enabled: canRun,
    placeholderData: keepPreviousData,
  });
}
