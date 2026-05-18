// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RPC_OFFLINE_FAILURE_STREAK,
  getRpcBackoffPollMs,
  getRpcFailureStreak,
  reportRpcFetchAttempt,
  reportRpcRateLimited,
  resetRpcConnectivityForTests,
  rpcBackoffPollMsForStreak,
} from "./rpcConnectivity";

describe("rpcBackoffPollMsForStreak", () => {
  it("uses fast interval below offline threshold", () => {
    expect(rpcBackoffPollMsForStreak(0, 1000)).toBe(1000);
    expect(rpcBackoffPollMsForStreak(RPC_OFFLINE_FAILURE_STREAK - 1, 5000)).toBe(5000);
  });

  it("steps 5s / 15s / 30s at and beyond threshold", () => {
    expect(rpcBackoffPollMsForStreak(RPC_OFFLINE_FAILURE_STREAK, 1000)).toBe(5_000);
    expect(rpcBackoffPollMsForStreak(RPC_OFFLINE_FAILURE_STREAK + 1, 1000)).toBe(15_000);
    expect(rpcBackoffPollMsForStreak(RPC_OFFLINE_FAILURE_STREAK + 2, 1000)).toBe(30_000);
    expect(rpcBackoffPollMsForStreak(100, 1000)).toBe(30_000);
  });
});

describe("reportRpcFetchAttempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:00:00Z"));
    resetRpcConnectivityForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRpcConnectivityForTests();
  });

  it("resets streak on success", () => {
    reportRpcFetchAttempt(false);
    vi.setSystemTime(new Date("2026-04-30T12:00:01Z"));
    reportRpcFetchAttempt(false);
    expect(getRpcFailureStreak()).toBe(2);
    reportRpcFetchAttempt(true);
    expect(getRpcFailureStreak()).toBe(0);
    expect(getRpcBackoffPollMs(1000)).toBe(1000);
  });

  it("counts at most one failure per wall second", () => {
    reportRpcFetchAttempt(false);
    reportRpcFetchAttempt(false);
    expect(getRpcFailureStreak()).toBe(1);
    vi.setSystemTime(new Date("2026-04-30T12:00:01Z"));
    reportRpcFetchAttempt(false);
    expect(getRpcFailureStreak()).toBe(2);
  });
});

describe("reportRpcRateLimited", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:00:00Z"));
    resetRpcConnectivityForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRpcConnectivityForTests();
  });

  it("jumps streak to offline threshold for immediate 5s backoff", () => {
    expect(getRpcFailureStreak()).toBe(0);
    reportRpcRateLimited();
    expect(getRpcFailureStreak()).toBe(RPC_OFFLINE_FAILURE_STREAK);
    expect(getRpcBackoffPollMs(1000)).toBe(5_000);
  });

  it("does not shrink an already higher streak", () => {
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 3, 30, 12, 0, i)));
      reportRpcFetchAttempt(false);
    }
    expect(getRpcFailureStreak()).toBe(5);
    reportRpcRateLimited();
    expect(getRpcFailureStreak()).toBe(5);
    expect(getRpcBackoffPollMs(1000)).toBe(30_000);
  });
});
