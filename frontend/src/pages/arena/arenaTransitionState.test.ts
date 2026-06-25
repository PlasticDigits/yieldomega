// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  buildPodiumTransitionMeta,
  derivePodiumTransitionState,
  hasIndexerIngestLag,
  isSuspiciousDeadline,
  transitionStateTestId,
} from "@/pages/arena/arenaTransitionState";

describe("arenaTransitionState", () => {
  it("derives live when armed and deadline is ahead of chain now", () => {
    expect(
      derivePodiumTransitionState({
        armed: true,
        deadlineSec: 2_000,
        chainNowSec: 1_000,
      }),
    ).toBe("live");
  });

  it("derives unarmed when timer not started", () => {
    expect(
      derivePodiumTransitionState({
        armed: false,
        deadlineSec: 2_000,
        chainNowSec: 1_000,
      }),
    ).toBe("unarmed");
  });

  it("derives expired-pending-roll at zero without ingest lag", () => {
    expect(
      derivePodiumTransitionState({
        armed: true,
        deadlineSec: 1_000,
        chainNowSec: 1_000,
        indexedThroughBlock: "120",
        readBlockNumber: "120",
      }),
    ).toBe("expired-pending-roll");
    expect(transitionStateTestId("expired-pending-roll")).toBe(
      "arena-timer-expired-pending-roll",
    );
  });

  it("derives settling when indexer ingest lags head", () => {
    expect(hasIndexerIngestLag("100", "120")).toBe(true);
    expect(
      derivePodiumTransitionState({
        armed: true,
        deadlineSec: 1_000,
        chainNowSec: 1_000,
        indexedThroughBlock: "100",
        readBlockNumber: "120",
      }),
    ).toBe("settling");
    expect(transitionStateTestId("settling")).toBe("arena-timer-settling");
  });

  it("derives epoch-advanced after epoch bump with fresh countdown", () => {
    expect(
      derivePodiumTransitionState({
        armed: true,
        deadlineSec: 2_000,
        chainNowSec: 1_000,
        latchedEpoch: "3",
        currentEpoch: "4",
      }),
    ).toBe("epoch-advanced");
  });

  it("degrades suspicious future deadlines to syncing", () => {
    expect(isSuspiciousDeadline(9_000_000, 1_000, 345_600)).toBe(true);
    expect(
      derivePodiumTransitionState({
        armed: true,
        deadlineSec: 9_000_000,
        chainNowSec: 1_000,
        timerCapSec: 345_600,
      }),
    ).toBe("syncing");
  });

  it("buildPodiumTransitionMeta exposes roll CTA only when expired-pending-roll", () => {
    const meta = buildPodiumTransitionMeta({
      contractIndex: 0,
      timerData: {
        read_block_number: "10",
        block_timestamp_sec: "1000",
        last_buy_deadline_sec: "1000",
        timer_cap_sec: "345600",
        arena_start_sec: "1",
        paused: false,
        total_doub_raised: "0",
        podium_deadlines_sec: ["1000", "0", "0", "0"],
        podium_timer_armed: [true, false, false, false],
      },
      chainNowSec: 1000,
      heroDisplay: true,
    });
    expect(meta.transitionState).toBe("expired-pending-roll");
    expect(meta.showRollCta).toBe(true);
    expect(meta.countdownDisplay).toBe("00:00:00:00");
  });
});
