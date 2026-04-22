// SPDX-License-Identifier: AGPL-3.0-only

/** Max input token to authorize for `exactOutput`, given quoter `amountIn` and slippage (BPS). */
export function swapMaxInputFromQuoted(quotedIn: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("timeCurveKumbayaSwap: slippageBps must be 0..10000");
  }
  return (quotedIn * BigInt(10_000 + slippageBps) + 9999n) / 10_000n;
}

export function swapDeadlineUnixSec(bufferSec = 600): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + bufferSec);
}
