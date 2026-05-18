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
