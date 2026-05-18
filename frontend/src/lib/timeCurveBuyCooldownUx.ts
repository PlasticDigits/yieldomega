// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import type { TransactionReceipt } from "viem";
import { getBlock } from "wagmi/actions";

/**
 * Inclusion block timestamp for a mined tx — aligns preemptive wallet buy-cooldown UX
 * with onchain `block.timestamp` semantics.
 */
export async function chainSecondsAtReceiptBlock(
  wagmiConfig: Config,
  receipt: TransactionReceipt,
): Promise<number> {
  const blk = await getBlock(wagmiConfig, { blockNumber: receipt.blockNumber });
  return Number(blk.timestamp);
}

/** Wall-clock deadline for buy cooldown UX — starts as soon as the tx is mined (before `getBlock`). */
export function buyCooldownWallUntilMsFromNow(cooldownSec: number): number {
  return Date.now() + Math.max(0, cooldownSec) * 1000;
}
