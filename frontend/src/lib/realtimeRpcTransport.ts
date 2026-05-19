// SPDX-License-Identifier: AGPL-3.0-only

import type { Transport } from "viem";
import { http } from "viem";

const REALTIME_SEND_RAW = "realtime_sendRawTransaction";
const ETH_SEND_RAW = "eth_sendRawTransaction";

/** Receipt shape returned by MegaETH `realtime_sendRawTransaction` (subset of viem receipt). */
export type RealtimeSubmitReceipt = {
  transactionHash: `0x${string}`;
  status?: `0x${string}` | string;
  blockNumber?: `0x${string}` | string;
  [key: string]: unknown;
};

const receiptByHash = new Map<string, RealtimeSubmitReceipt>();

/** Last realtime submit receipt keyed by tx hash (for {@link takeRealtimeSubmitReceipt}). */
export function takeRealtimeSubmitReceipt(hash: `0x${string}`): RealtimeSubmitReceipt | undefined {
  const key = hash.toLowerCase();
  const r = receiptByHash.get(key);
  if (r) receiptByHash.delete(key);
  return r;
}

function storeRealtimeReceipt(receipt: RealtimeSubmitReceipt) {
  const h = receipt.transactionHash;
  if (h && typeof h === "string") {
    receiptByHash.set(h.toLowerCase(), receipt);
  }
}

function isRealtimeReceiptResult(result: unknown): result is RealtimeSubmitReceipt {
  return (
    result != null &&
    typeof result === "object" &&
    "transactionHash" in result &&
    typeof (result as RealtimeSubmitReceipt).transactionHash === "string"
  );
}

/**
 * Wraps an HTTP transport: `eth_sendRawTransaction` → `realtime_sendRawTransaction` ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)).
 */
export function wrapTransportWithRealtimeSendRaw(inner: Transport): Transport {
  return ((config) => {
    const base = inner(config);
    return {
      ...base,
      request: async (body, options) => {
        type RpcBody = { method: string; params?: unknown };

        const rewrite = (single: RpcBody): RpcBody => {
          if (single.method === ETH_SEND_RAW) {
            return { ...single, method: REALTIME_SEND_RAW };
          }
          return single;
        };

        const rewriteEntry = (entry: unknown): unknown => {
          if (
            entry &&
            typeof entry === "object" &&
            "method" in entry &&
            typeof (entry as RpcBody).method === "string"
          ) {
            return rewrite(entry as RpcBody);
          }
          return entry;
        };

        if (Array.isArray(body)) {
          const mapped = body.map(rewriteEntry) as typeof body;
          const result = await base.request(mapped, options);
          if (Array.isArray(result)) {
            for (const r of result) {
              if (isRealtimeReceiptResult(r)) storeRealtimeReceipt(r);
            }
          }
          return result;
        }

        const mapped = rewriteEntry(body) as typeof body;
        const result = await base.request(mapped, options);
        if (isRealtimeReceiptResult(result)) {
          storeRealtimeReceipt(result);
        }
        return result;
      },
    };
  }) as Transport;
}

/** HTTP transport with optional realtime send wrapper. */
export function httpWithRealtimeSendRaw(url: string | undefined): Transport {
  return wrapTransportWithRealtimeSendRaw(url ? http(url) : http());
}
