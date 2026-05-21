// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import { formatUnits } from "viem";
import { readContract } from "wagmi/actions";
import type { HexAddress } from "@/lib/addresses";
import { resolveKumbayaRouting, type KumbayaEnv } from "@/lib/kumbayaRoutes";
import { kumbayaQuoterV2Abi } from "@/lib/abis";

const ONE_CL8Y_OUT = 10n ** 18n;

function amountInFromQuoteResult(result: unknown): bigint {
  return (result as readonly [bigint, ...unknown[]])[0];
}

async function quoteUsdmInForOneCl8yOut(
  wagmiConfig: Config,
  quoter: HexAddress,
  kConfig: { weth: HexAddress; usdm: HexAddress; cl8yWethFee: number; usdmWethFee: number },
  acceptedCl8y: HexAddress,
): Promise<bigint> {
  const wethIn = (await readContract(wagmiConfig, {
    address: quoter,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutputSingle",
    args: [
      {
        tokenIn: kConfig.weth,
        tokenOut: acceptedCl8y,
        amount: ONE_CL8Y_OUT,
        fee: kConfig.cl8yWethFee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })) as unknown;
  const wethNeeded = amountInFromQuoteResult(wethIn);

  const usdmIn = (await readContract(wagmiConfig, {
    address: quoter,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutputSingle",
    args: [
      {
        tokenIn: kConfig.usdm,
        tokenOut: kConfig.weth,
        amount: wethNeeded,
        fee: kConfig.usdmWethFee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })) as unknown;
  return amountInFromQuoteResult(usdmIn);
}

export type Cl8ySpotUsdQuote = {
  /** USD per 1 CL8Y (USDM leg treated as ~$1). */
  usdPerCl8y: number;
  usdmWeiPerCl8yWad: bigint;
};

/**
 * Spot CL8Y/USD via Kumbaya quoter: USDM required to buy **1 CL8Y** on the CL8Y←WETH←USDM path.
 * Returns `null` when routing is unavailable or the quote fails.
 */
export async function fetchCl8ySpotUsdFromKumbaya(
  wagmiConfig: Config,
  chainId: number,
  acceptedCl8y: HexAddress,
  env: KumbayaEnv = import.meta.env,
): Promise<Cl8ySpotUsdQuote | null> {
  const resolved = resolveKumbayaRouting(chainId, env);
  if (!resolved.ok) {
    return null;
  }
  try {
    const usdmWei = await quoteUsdmInForOneCl8yOut(
      wagmiConfig,
      resolved.config.quoter,
      resolved.config,
      acceptedCl8y,
    );
    const usdPerCl8y = Number(formatUnits(usdmWei, 18));
    if (!Number.isFinite(usdPerCl8y) || usdPerCl8y <= 0) {
      return null;
    }
    return { usdPerCl8y, usdmWeiPerCl8yWad: usdmWei };
  } catch {
    return null;
  }
}

/** CL8Y wei total × USD/CL8Y → USD string for display. */
export function cl8yWeiToUsdDisplay(cl8yWei: bigint, usdPerCl8y: number | undefined): string | undefined {
  if (usdPerCl8y === undefined || !Number.isFinite(usdPerCl8y)) {
    return undefined;
  }
  const human = Number(formatUnits(cl8yWei, 18));
  if (!Number.isFinite(human)) {
    return undefined;
  }
  return (human * usdPerCl8y).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
