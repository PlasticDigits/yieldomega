// SPDX-License-Identifier: AGPL-3.0-only

import { useSyncExternalStore } from "react";
import {
  RPC_OFFLINE_FAILURE_STREAK,
  getRpcBackoffPollMs,
  getRpcFailureStreak,
  subscribeRpcConnectivity,
} from "@/lib/rpcConnectivity";

export type UseRpcConnectivityResult = {
  failureStreak: number;
  /** True after {@link RPC_OFFLINE_FAILURE_STREAK} debounced failure seconds — poll intervals step to 5s / 15s / 30s. */
  isOffline: boolean;
  backoffPollMs: typeof getRpcBackoffPollMs;
};

/**
 * Reactive JSON-RPC health for wagmi reads ([GitLab #221](https://gitlab.com/PlasticDigits/yieldomega/-/issues/221)).
 * Subscribes to {@link subscribeRpcConnectivity} so poll intervals reschedule when the shared streak changes.
 */
export function useRpcConnectivity(): UseRpcConnectivityResult {
  const failureStreak = useSyncExternalStore(
    subscribeRpcConnectivity,
    getRpcFailureStreak,
    getRpcFailureStreak,
  );
  return {
    failureStreak,
    isOffline: failureStreak >= RPC_OFFLINE_FAILURE_STREAK,
    backoffPollMs: getRpcBackoffPollMs,
  };
}

/** Current backoff interval for a fast baseline (e.g. 1000ms block head poll). Re-renders when streak changes. */
export function useRpcBackoffPollInterval(fastIntervalMs: number): number {
  const { backoffPollMs } = useRpcConnectivity();
  return backoffPollMs(fastIntervalMs);
}
