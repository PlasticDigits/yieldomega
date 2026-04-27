// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import { getBlock } from "wagmi/actions";

/** Fixed Kumbaya `exactOutput` headroom on max input (3%). Not user-configurable. */
export const KUMBAYA_SWAP_SLIPPAGE_BPS = 300;

/** Max input token to authorize for `exactOutput`, given quoter `amountIn` and slippage (BPS). */
export function swapMaxInputFromQuoted(quotedIn: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("timeCurveKumbayaSwap: slippageBps must be 0..10000");
  }
  return (quotedIn * BigInt(10_000 + slippageBps) + 9999n) / 10_000n;
}

/**
 * Kumbaya / Uniswap-style swap deadline in unix seconds, aligned to **chain** time.
 * Routers compare `params.deadline` to `block.timestamp`; using wall clock breaks after
 * `anvil_increaseTime` / rich-state warps where chain time runs ahead of the browser ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)).
 */
export function swapDeadlineUnixSecFromChainTimestamp(
  chainTimestampSec: number,
  bufferSec = 600,
): bigint {
  if (!Number.isFinite(chainTimestampSec) || chainTimestampSec < 0) {
    throw new Error("timeCurveKumbayaSwap: chainTimestampSec must be a non-negative finite number");
  }
  return BigInt(Math.floor(chainTimestampSec) + bufferSec);
}

/** Latest head `block.timestamp` (seconds) for swap deadline encoding. */
export async function readSwapDeadlineChainTimestampSec(wagmiConfig: Config): Promise<number> {
  const block = await getBlock(wagmiConfig, { blockTag: "latest" });
  return Number(block.timestamp);
}

/**
 * Fetch latest head time and return onchain swap deadline (chain + buffer).
 * Call immediately before building swap / `buyViaKumbaya` calldata (same submit window as [#82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) sizing).
 */
export async function fetchSwapDeadlineUnixSec(
  wagmiConfig: Config,
  bufferSec = 600,
): Promise<bigint> {
  const ts = await readSwapDeadlineChainTimestampSec(wagmiConfig);
  return swapDeadlineUnixSecFromChainTimestamp(ts, bufferSec);
}
