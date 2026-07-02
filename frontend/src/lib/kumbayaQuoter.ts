// SPDX-License-Identifier: AGPL-3.0-only
//
// Kumbaya QuoterV2 reads for TimeArena ETH / USDM entry. On MegaETH mainnet,
// `quoteExactOutput(bytes)` reverts (`toAddress_outOfBounds`); use `quoteExactOutputSingle` hops.

import type { Config } from "wagmi";
import { readContract } from "wagmi/actions";
import type { HexAddress } from "@/lib/addresses";
import { kumbayaQuoterV2Abi, timeArenaReadAbi } from "@/lib/abis";
import type { KumbayaChainConfigResolved, PayWithAsset } from "@/lib/kumbayaRoutes";
import { WAD } from "@/lib/timeArenaMath";
import { kumbayaBuyDebugLog } from "@/lib/kumbayaBuyDebug";

function amountInFromQuoteResult(result: unknown): bigint {
  return (result as readonly [bigint, ...unknown[]])[0];
}

/** Gross DOUB the TimeArena buy router requests at inclusion (`charmWad × charmPriceWad / WAD`). */
export async function readGrossDoubForCharmWad(
  wagmiConfig: Config,
  timeArenaAddress: HexAddress,
  charmWad: bigint,
): Promise<bigint> {
  const price = (await readContract(wagmiConfig, {
    address: timeArenaAddress,
    abi: timeArenaReadAbi,
    functionName: "effectiveCharmPriceWad",
  })) as bigint;
  const gross = (charmWad * price) / WAD;
  kumbayaBuyDebugLog("readGrossDoubForCharmWad", {
    timeArena: timeArenaAddress,
    charmWad: charmWad.toString(),
    charmPriceWad: price.toString(),
    grossDoub: gross.toString(),
  });
  return gross;
}

/**
 * Extra DOUB out used only when sizing swap `maxIn` so a rising price
 * between quote and inclusion is less likely to trip Uniswap `STF()`.
 */
export const KUMBAYA_GROSS_CL8Y_QUOTE_HEADROOM_BPS = 150;

export function grossCl8yWithQuoteHeadroom(grossCl8y: bigint): bigint {
  return (grossCl8y * (10_000n + BigInt(KUMBAYA_GROSS_CL8Y_QUOTE_HEADROOM_BPS))) / 10_000n;
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

async function quoteEthPathAmountIn(
  wagmiConfig: Config,
  quoter: HexAddress,
  kConfig: KumbayaChainConfigResolved,
  acceptedCl8y: HexAddress,
  cl8yAmountOut: bigint,
): Promise<bigint> {
  return quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.weth,
    acceptedCl8y,
    cl8yAmountOut,
    kConfig.cl8yWethFee,
  );
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
 * Pay-token input for the swap leg. `path` is still passed to `buyViaKumbaya` onchain.
 * `amountOut` should be the router's gross DOUB target (see `readGrossDoubForCharmWad`).
 */
export async function quoteKumbayaExactOutputAmountIn(
  wagmiConfig: Config,
  params: {
    quoter: HexAddress;
    kConfig: KumbayaChainConfigResolved;
    payWith: Exclude<PayWithAsset, "cl8y">;
    acceptedCl8y: HexAddress;
    amountOut: bigint;
  },
): Promise<bigint> {
  const { quoter, kConfig, payWith, acceptedCl8y, amountOut } = params;
  const outForQuote = grossCl8yWithQuoteHeadroom(amountOut);
  kumbayaBuyDebugLog("quoteKumbayaExactOutputAmountIn:start", {
    payWith,
    quoter,
    acceptedCl8y,
    grossDoubTarget: amountOut.toString(),
    quoteHeadroomBps: KUMBAYA_GROSS_CL8Y_QUOTE_HEADROOM_BPS,
    amountOutWithHeadroom: outForQuote.toString(),
    cl8yWethFee: kConfig.cl8yWethFee,
    usdmWethFee: kConfig.usdmWethFee,
  });
  let amountIn: bigint;
  if (payWith === "usdm") {
    amountIn = await quoteUsdmPathAmountIn(wagmiConfig, quoter, kConfig, acceptedCl8y, outForQuote);
  } else {
    amountIn = await quoteEthPathAmountIn(wagmiConfig, quoter, kConfig, acceptedCl8y, outForQuote);
  }
  kumbayaBuyDebugLog("quoteKumbayaExactOutputAmountIn:done", {
    payWith,
    quotedAmountIn: amountIn.toString(),
  });
  return amountIn;
}

async function quoteArenaEthPathAmountIn(
  wagmiConfig: Config,
  quoter: HexAddress,
  kConfig: KumbayaChainConfigResolved,
  doubAddress: HexAddress,
  doubAmountOut: bigint,
): Promise<bigint> {
  const cl8yIn = await quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.cl8y,
    doubAddress,
    doubAmountOut,
    kConfig.doubCl8yFee,
  );
  return quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.weth,
    kConfig.cl8y,
    cl8yIn,
    kConfig.cl8yWethFee,
  );
}

async function quoteArenaUsdmPathAmountIn(
  wagmiConfig: Config,
  quoter: HexAddress,
  kConfig: KumbayaChainConfigResolved,
  doubAddress: HexAddress,
  doubAmountOut: bigint,
): Promise<bigint> {
  const cl8yIn = await quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.cl8y,
    doubAddress,
    doubAmountOut,
    kConfig.doubCl8yFee,
  );
  const wethIn = await quoteExactOutputSingleAmountIn(
    wagmiConfig,
    quoter,
    kConfig.weth,
    kConfig.cl8y,
    cl8yIn,
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

/** Pay-token input for Arena `buyViaKumbaya`; `amountOut` is gross DOUB. */
export async function quoteKumbayaArenaExactOutputAmountIn(
  wagmiConfig: Config,
  params: {
    quoter: HexAddress;
    kConfig: KumbayaChainConfigResolved;
    payWith: Exclude<PayWithAsset, "doub" | "cred">;
    doubAddress: HexAddress;
    amountOut: bigint;
  },
): Promise<bigint> {
  const { quoter, kConfig, payWith, doubAddress, amountOut } = params;
  const outForQuote = grossCl8yWithQuoteHeadroom(amountOut);
  if (payWith === "cl8y") {
    return quoteExactOutputSingleAmountIn(
      wagmiConfig,
      quoter,
      kConfig.cl8y,
      doubAddress,
      outForQuote,
      kConfig.doubCl8yFee,
    );
  }
  if (payWith === "usdm") {
    return quoteArenaUsdmPathAmountIn(wagmiConfig, quoter, kConfig, doubAddress, outForQuote);
  }
  return quoteArenaEthPathAmountIn(wagmiConfig, quoter, kConfig, doubAddress, outForQuote);
}
