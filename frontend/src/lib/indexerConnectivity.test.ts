// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INDEXER_OFFLINE_FAILURE_STREAK,
  getIndexerBackoffPollMs,
  getIndexerFailureStreak,
  indexerBackoffPollMsForStreak,
  reportIndexerFetchAttempt,
  resetIndexerConnectivityForTests,
} from "./indexerConnectivity";

describe("indexerBackoffPollMsForStreak", () => {
  it("uses fast interval below offline threshold", () => {
    expect(indexerBackoffPollMsForStreak(0, 1000)).toBe(1000);
    expect(indexerBackoffPollMsForStreak(INDEXER_OFFLINE_FAILURE_STREAK - 1, 5000)).toBe(5000);
  });

  it("steps 30s / 60s / 120s at and beyond threshold", () => {
    expect(indexerBackoffPollMsForStreak(INDEXER_OFFLINE_FAILURE_STREAK, 1000)).toBe(30_000);
    expect(indexerBackoffPollMsForStreak(INDEXER_OFFLINE_FAILURE_STREAK + 1, 1000)).toBe(60_000);
    expect(indexerBackoffPollMsForStreak(INDEXER_OFFLINE_FAILURE_STREAK + 2, 1000)).toBe(120_000);
    expect(indexerBackoffPollMsForStreak(100, 1000)).toBe(120_000);
  });
});

describe("reportIndexerFetchAttempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:00:00Z"));
    resetIndexerConnectivityForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetIndexerConnectivityForTests();
  });

  it("resets streak on success", () => {
    reportIndexerFetchAttempt(false);
    vi.setSystemTime(new Date("2026-04-30T12:00:01Z"));
    reportIndexerFetchAttempt(false);
    expect(getIndexerFailureStreak()).toBe(2);
    reportIndexerFetchAttempt(true);
    expect(getIndexerFailureStreak()).toBe(0);
    expect(getIndexerBackoffPollMs(1000)).toBe(1000);
  });

  it("counts at most one failure per wall second", () => {
    reportIndexerFetchAttempt(false);
    reportIndexerFetchAttempt(false);
    reportIndexerFetchAttempt(false);
    expect(getIndexerFailureStreak()).toBe(1);
    vi.setSystemTime(new Date("2026-04-30T12:00:01Z"));
    reportIndexerFetchAttempt(false);
    expect(getIndexerFailureStreak()).toBe(2);
  });

  it("exposes 30s backoff after offline threshold", () => {
    for (let i = 0; i < INDEXER_OFFLINE_FAILURE_STREAK; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 3, 30, 12, 0, i)));
      reportIndexerFetchAttempt(false);
    }
    expect(getIndexerFailureStreak()).toBe(INDEXER_OFFLINE_FAILURE_STREAK);
    expect(getIndexerBackoffPollMs(1000)).toBe(30_000);
  });
});
