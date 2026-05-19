// SPDX-License-Identifier: AGPL-3.0-only

import type { Config } from "wagmi";
import type { TransactionReceipt } from "viem";
import { waitForTransactionReceipt } from "wagmi/actions";
import { takeRealtimeSubmitReceipt } from "@/lib/realtimeRpcTransport";

export const REALTIME_RECEIPT_TIMEOUT_MS = 10_000;

export type WaitForWriteReceiptParams = {
  hash: `0x${string}`;
  /** When realtime submit already returned a receipt, skip polling unless this elapses waiting for cache. */
  timeoutMs?: number;
};

function isViemTransactionReceipt(value: unknown): value is TransactionReceipt {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const r = value as TransactionReceipt;
  return (
    (r.status === "success" || r.status === "reverted") &&
    typeof r.blockNumber === "bigint" &&
    typeof r.blockHash === "string"
  );
}

/**
 * Prefer receipt captured from `realtime_sendRawTransaction` on submit; otherwise poll
 * `eth_getTransactionReceipt` via wagmi ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)).
 */
export async function waitForWriteReceipt(
  wagmiConfig: Config,
  { hash, timeoutMs = REALTIME_RECEIPT_TIMEOUT_MS }: WaitForWriteReceiptParams,
): Promise<TransactionReceipt> {
  const cached = takeRealtimeSubmitReceipt(hash);
  if (cached && isViemTransactionReceipt(cached)) {
    return cached;
  }

  return waitForTransactionReceipt(wagmiConfig, {
    hash,
    timeout: cached ? Math.min(timeoutMs, 5_000) : timeoutMs,
  });
}
