// SPDX-License-Identifier: AGPL-3.0-only

import type { Transport } from "viem";
import { fallback, http } from "viem";
import {
  assertFilterRpcMethodAllowedForUrl,
  getFilterMethodExcludesForRpcUrl,
} from "@/lib/rpcFilterCapability";
import { wrapTransportWithRealtimeSendRaw } from "@/lib/realtimeRpcTransport";

/** Opt-in: set `VITE_RPC_DEBUG=1` to log JSON-RPC attempts and fallback switches (browser console). */
export function isRpcDebugEnabled(): boolean {
  return import.meta.env.VITE_RPC_DEBUG === "1";
}

/** Human-readable JSON-RPC method(s) for logging (handles batch arrays). */
export function formatJsonRpcMethodLabel(body: unknown): string {
  if (Array.isArray(body)) {
    return body
      .map((x) =>
        x && typeof x === "object" && "method" in x && typeof (x as { method: unknown }).method === "string"
          ? (x as { method: string }).method
          : "?",
      )
      .join(", ");
  }
  if (body && typeof body === "object" && "method" in body) {
    const m = (body as { method: unknown }).method;
    return typeof m === "string" ? m : "?";
  }
  return "?";
}

function forEachJsonRpcMethod(body: unknown, fn: (method: string) => void): void {
  if (Array.isArray(body)) {
    for (const item of body) {
      if (
        item &&
        typeof item === "object" &&
        "method" in item &&
        typeof (item as { method: unknown }).method === "string"
      ) {
        fn((item as { method: string }).method);
      }
    }
    return;
  }
  if (body && typeof body === "object" && "method" in body) {
    const m = (body as { method: unknown }).method;
    if (typeof m === "string") fn(m);
  }
}

/** Skips filter JSON-RPC on endpoints that failed the startup filter probe (viem fallback). */
export function wrapTransportWithFilterCapabilityGate(
  rpcUrl: string | undefined,
  inner: Transport,
): Transport {
  return ((config) => {
    const base = inner(config);
    return {
      ...base,
      request: async (body, options) => {
        forEachJsonRpcMethod(body, (method) => assertFilterRpcMethodAllowedForUrl(rpcUrl, method));
        return base.request(body, options);
      },
    };
  }) as Transport;
}

/**
 * Wraps a viem transport: logs each `request`, warns on failure, and notes when fallback will try the next URL.
 */
export function wrapTransportWithRpcDebug(
  params: { endpointLabel: string; index: number; total: number },
  inner: Transport,
): Transport {
  const { endpointLabel, index, total } = params;
  const slot = `[${index + 1}/${total}]`;
  return ((config) => {
    const base = inner(config);
    return {
      ...base,
      request: async (body, options) => {
        const method = formatJsonRpcMethodLabel(body);
        console.info(`[yieldomega/rpc] ${slot} ${endpointLabel}`, { method });
        try {
          return await base.request(body, options);
        } catch (err) {
          const hasNextFallback = total > 1 && index < total - 1;
          console.warn(`[yieldomega/rpc] ${slot} ${endpointLabel} FAILED`, { method, hasNextFallback }, err);
          if (hasNextFallback) {
            console.info(`[yieldomega/rpc] switching to fallback endpoint (${index + 2}/${total})`);
          }
          throw err;
        }
      },
    };
  }) as Transport;
}

/** Single `http()` transport with MegaETH realtime send + optional RPC debug logging. */
export function httpWithOptionalRpcDebug(url: string | undefined, index: number, total: number): Transport {
  const filterExcludes = url ? getFilterMethodExcludesForRpcUrl(url) : [];
  let inner: Transport = wrapTransportWithFilterCapabilityGate(
    url,
    wrapTransportWithRealtimeSendRaw(
      url
        ? http(url, { methods: { exclude: filterExcludes } })
        : http(),
    ),
  );
  if (isRpcDebugEnabled()) {
    inner = wrapTransportWithRpcDebug(
      { endpointLabel: url ?? "(chain default)", index, total },
      inner,
    );
  }
  return inner;
}

/** Ordered `http` transports with viem `fallback` (no ranking), each optionally wrapped for debug logs. */
export function fallbackHttpUrls(urls: string[]): Transport {
  if (urls.length === 0) {
    return httpWithOptionalRpcDebug(undefined, 0, 1);
  }
  if (urls.length === 1) {
    return httpWithOptionalRpcDebug(urls[0], 0, 1);
  }
  const transports = urls.map((u, i) => httpWithOptionalRpcDebug(u, i, urls.length));
  return fallback(transports, { rank: false });
}
