// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared JSON-RPC HTTP health for frontend polling (wagmi / viem reads), mirroring
 * {@link ./indexerConnectivity.ts} tiering: fast interval while healthy, then **5s → 15s → 30s**
 * after consecutive failure seconds, with **HTTP 429** jumping straight to offline-tier backoff.
 */

/** @internal — keep aligned with {@link INDEXER_OFFLINE_FAILURE_STREAK}. */
export const RPC_OFFLINE_FAILURE_STREAK = 3;

const BACKOFF_MS = [5_000, 15_000, 30_000] as const;

let failureStreak = 0;
let lastFailCountedSec = -1;

const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) {
    cb();
  }
}

/**
 * Call after a wagmi read query settles: `true` on success, `false` on transport / HTTP errors.
 */
export function reportRpcFetchAttempt(ok: boolean): void {
  if (ok) {
    if (failureStreak !== 0 || lastFailCountedSec !== -1) {
      failureStreak = 0;
      lastFailCountedSec = -1;
      notify();
    }
    return;
  }
  const sec = Math.floor(Date.now() / 1000);
  if (sec === lastFailCountedSec) {
    return;
  }
  lastFailCountedSec = sec;
  failureStreak = Math.min(failureStreak + 1, 10_000);
  notify();
}

/** HTTP 429 from the RPC: same “jump to backoff” behavior as the indexer helper. */
export function reportRpcRateLimited(): void {
  failureStreak = Math.max(failureStreak, RPC_OFFLINE_FAILURE_STREAK);
  lastFailCountedSec = Math.floor(Date.now() / 1000);
  notify();
}

export function subscribeRpcConnectivity(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getRpcFailureStreak(): number {
  return failureStreak;
}

export function isRpcFailureStreakOffline(): boolean {
  return failureStreak >= RPC_OFFLINE_FAILURE_STREAK;
}

export function rpcBackoffPollMsForStreak(streak: number, fastIntervalMs: number): number {
  if (streak < RPC_OFFLINE_FAILURE_STREAK) {
    return fastIntervalMs;
  }
  const tier = Math.min(streak - RPC_OFFLINE_FAILURE_STREAK, BACKOFF_MS.length - 1);
  return BACKOFF_MS[tier];
}

export function getRpcBackoffPollMs(fastIntervalMs: number): number {
  return rpcBackoffPollMsForStreak(failureStreak, fastIntervalMs);
}

/** Vitest-only reset. */
export function resetRpcConnectivityForTests(): void {
  failureStreak = 0;
  lastFailCountedSec = -1;
  notify();
}
