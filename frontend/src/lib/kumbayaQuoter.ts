// SPDX-License-Identifier: AGPL-3.0-only
//
// Kumbaya QuoterV2 reads for TimeCurve ETH / USDM entry. MegaETH mainnet `quoteExactOutput(bytes)`
// reverts on paths that include USDm; USDM mode uses two `quoteExactOutputSingle` hops instead.

import type { Config } from "wagmi";
import { readContract } from "wagmi/actions";
import type { HexAddress } from "@/lib/addresses";
import { kumbayaQuoterV2Abi } from "@/lib/abis";
import type { KumbayaChainConfigResolved, PayWithAsset } from "@/lib/kumbayaRoutes";

function amountInFromQuoteResult(result: unknown): bigint {
  return (result as readonly [bigint, ...unknown[]])[0];
}

/** USDM pay uses composite singles; ETH uses packed-path `quoteExactOutput`. */
export function kumbayaQuoteUsesCompositeSingles(payWith: PayWithAsset): boolean {
  return payWith === "usdm";
}

async function quoteExactOutputSingleAmountIn(
  wagmiConfig: Config,
  quoter: HexAddress,
  tokenIn: HexAddress,
  tokenOut: HexAddress,
  amountOut: bigint,
  fee: number,
): Promise<bigint> {
  const result = await readContract(wagmiConfig, {
    address: quoter,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amount: amountOut,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return amountInFromQuoteResult(result);
}

async function quoteUsdmPathAmountIn(
  wagmiConfig: Config,
  quoter: HexAddress,
  kConfig: KumbayaChainConfigResolved,
  acceptedCl8y: HexAddress,
  cl8yAmountOut: bigint,
): Promise<bigint> {
  const wethIn = await quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.weth,
    acceptedCl8y,
    cl8yAmountOut,
    kConfig.cl8yWethFee,
  );
  return quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.usdm,
    kConfig.weth,
    wethIn,
    kConfig.usdmWethFee,
  );
}

/**
 * Gross pay-token input for an `exactOutput` swap that delivers `amountOut` CL8Y.
 * `path` is still required for ETH (bytes quoter) and for onchain `buyViaKumbaya` calldata.
 */
export async function quoteKumbayaExactOutputAmountIn(
  wagmiConfig: Config,
  params: {
    quoter: HexAddress;
    kConfig: KumbayaChainConfigResolved;
    payWith: Exclude<PayWithAsset, "cl8y">;
    acceptedCl8y: HexAddress;
    path: `0x${string}`;
    amountOut: bigint;
  },
): Promise<bigint> {
  const { quoter, kConfig, payWith, acceptedCl8y, path, amountOut } = params;
  if (kumbayaQuoteUsesCompositeSingles(payWith)) {
    return quoteUsdmPathAmountIn(wagmiConfig, quoter, kConfig, acceptedCl8y, amountOut);
  }
  const result = await readContract(wagmiConfig, {
    address: quoter,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args: [path, amountOut],
  });
  return amountInFromQuoteResult(result);
}
