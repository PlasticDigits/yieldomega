// SPDX-License-Identifier: AGPL-3.0-only

import { BaseError, formatUnits } from "viem";

const LOG_PREFIX = "[yieldomega:kumbaya-buy]";

/** Dev, `VITE_DEBUG_KUMBAYA_BUY=1`, or `localStorage.yieldomega.debugKumbayaBuy === "1"`. */
export function isKumbayaBuyDebugEnabled(): boolean {
  const env = import.meta.env.VITE_DEBUG_KUMBAYA_BUY;
  if (env === "0" || env === "false") return false;
  if (env === "1" || env === "true") return true;
  if (import.meta.env.DEV) return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("yieldomega.debugKumbayaBuy") === "1";
  } catch {
    return false;
  }
}

export function logKumbayaBuyDebugHelpOnce(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const w = window as Window & { __yieldomegaKumbayaBuyDebugHelp?: boolean };
  if (w.__yieldomegaKumbayaBuyDebugHelp) return;
  w.__yieldomegaKumbayaBuyDebugHelp = true;
  console.info(
    `${LOG_PREFIX} Prod debug: localStorage.setItem("yieldomega.debugKumbayaBuy","1"); location.reload()`,
  );
}

function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

export function formatKumbayaWei(wei: bigint, decimals: number, symbol?: string): string {
  try {
    const human = formatUnits(wei, decimals);
    return symbol ? `${human} ${symbol}` : human;
  } catch {
    return wei.toString();
  }
}

export function kumbayaBuyDebugLog(step: string, payload?: Record<string, unknown>): void {
  if (!isKumbayaBuyDebugEnabled()) return;
  if (payload === undefined) {
    console.warn(LOG_PREFIX, step);
    return;
  }
  console.warn(LOG_PREFIX, step, serializeValue(payload));
}

export function kumbayaBuyDebugError(step: string, err: unknown, payload?: Record<string, unknown>): void {
  if (!isKumbayaBuyDebugEnabled()) return;
  const errPayload: Record<string, unknown> = {
    ...payload,
    errorName: err instanceof Error ? err.name : typeof err,
    errorMessage: err instanceof Error ? err.message : String(err),
  };
  if (err instanceof BaseError) {
    errPayload.shortMessage = err.shortMessage;
    errPayload.details = err.details;
    if ("cause" in err && err.cause !== undefined) {
      errPayload.cause = err.cause instanceof Error ? err.cause.message : String(err.cause);
    }
    if ("walk" in err && typeof err.walk === "function") {
      const reverts: string[] = [];
      err.walk((sub): boolean => {
        if (sub instanceof BaseError && sub.shortMessage) {
          reverts.push(sub.shortMessage);
        }
        return true;
      });
      if (reverts.length) errPayload.revertWalk = reverts;
    }
  }
  console.error(LOG_PREFIX, step, serializeValue(errPayload));
}
