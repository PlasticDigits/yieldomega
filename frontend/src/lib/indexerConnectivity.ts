// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared indexer HTTP health for adaptive polling and offline UX ([issue #96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)).
 *
 * **Failure counting:** `reportIndexerFetchAttempt(false)` increments the streak **at most once per
 * wall-clock second** so multiple concurrent pollers (chain-timer, buys, `/v1/status`) do not
 * amplify the same outage into an instant max backoff.
 *
 * **Offline (user-visible):** {@link isIndexerFailureStreakOffline} is true after
 * {@link INDEXER_OFFLINE_FAILURE_STREAK} distinct failure seconds (≈ consecutive seconds with at
 * least one failed indexer request).
 *
 * **Backoff (circuit-style):** when offline, poll intervals step **5s → 15s → 30s** (capped) via
 * {@link indexerBackoffPollMsForStreak}; any successful fetch resets the streak.
 *
 * **HTTP 429:** {@link reportIndexerRateLimited} jumps the streak to the offline threshold immediately
 * so all pollers back off together without waiting for debounced failure seconds.
 */

/** @internal */
export const INDEXER_OFFLINE_FAILURE_STREAK = 3;

/**
 * Wall-clock gap for coalescing indexer-touching handlers wired from chain-event bursts (Buy / WarBow
 * logs). Scheduled polls already respect ~1s (or backoff); without this, each log can trigger a full
 * WarBow leaderboard pagination pass and other HTTP work, overwhelming rate limits ([issue #96]).
 */
export const INDEXER_EVENT_COALESCE_MS = 1000;

const BACKOFF_MS = [5_000, 15_000, 30_000] as const;

let failureStreak = 0;
/** Last wall second bucket that incremented `failureStreak` (debounce duplicate failure reports). */
let lastFailCountedSec = -1;

const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) {
    cb();
  }
}

/**
 * Call after any indexer HTTP round-trip: `true` if the response was usable for that caller,
 * `false` on network error, HTTP error, or null body.
 */
export function reportIndexerFetchAttempt(ok: boolean): void {
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

/**
 * HTTP 429 from the indexer: jump straight to offline-tier backoff so every poller backs off together
 * instead of continuing at 1s until the debounced failure streak catches up ([issue #96]).
 */
export function reportIndexerRateLimited(): void {
  failureStreak = Math.max(failureStreak, INDEXER_OFFLINE_FAILURE_STREAK);
  lastFailCountedSec = Math.floor(Date.now() / 1000);
  notify();
}

export function subscribeIndexerConnectivity(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getIndexerFailureStreak(): number {
  return failureStreak;
}

export function isIndexerFailureStreakOffline(): boolean {
  return failureStreak >= INDEXER_OFFLINE_FAILURE_STREAK;
}

/** Pure helper for tests and docs — same tier math as {@link getIndexerBackoffPollMs}. */
export function indexerBackoffPollMsForStreak(streak: number, fastIntervalMs: number): number {
  if (streak < INDEXER_OFFLINE_FAILURE_STREAK) {
    return fastIntervalMs;
  }
  const tier = Math.min(streak - INDEXER_OFFLINE_FAILURE_STREAK, BACKOFF_MS.length - 1);
  return BACKOFF_MS[tier];
}

export function getIndexerBackoffPollMs(fastIntervalMs: number): number {
  return indexerBackoffPollMsForStreak(failureStreak, fastIntervalMs);
}

/** Test-only reset (Vitest). */
export function resetIndexerConnectivityForTests(): void {
  failureStreak = 0;
  lastFailCountedSec = -1;
  notify();
}
