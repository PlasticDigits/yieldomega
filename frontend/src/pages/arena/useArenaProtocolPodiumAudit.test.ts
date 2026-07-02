// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  podiumAuditSecondsRemaining,
  readPodiumTimerSecFromMulticall,
} from "@/pages/arena/useArenaProtocolPodiumAudit";
import type { ArenaTimersResponse } from "@/lib/indexerApi";

const timers: ArenaTimersResponse = {
  read_block_number: "1",
  block_timestamp_sec: "1000",
  last_buy_deadline_sec: "1900",
  timer_cap_sec: "86400",
  arena_start_sec: "0",
  paused: false,
  total_doub_raised: "0",
  podium_deadlines_sec: ["1900", "2500", "2600", "2700"],
  podium_timer_armed: [true, true, true, true],
};

describe("podiumAuditSecondsRemaining", () => {
  it("uses last buy deadline for category 0", () => {
    expect(podiumAuditSecondsRemaining(0, timers, 1000)).toBe(900);
  });

  it("uses podium deadline for non-last-buy categories", () => {
    expect(podiumAuditSecondsRemaining(3, timers, 1000)).toBe(1700);
  });

  it("returns undefined when timer unarmed", () => {
    const unarmed = { ...timers, podium_timer_armed: [false, true, true, true] };
    expect(podiumAuditSecondsRemaining(0, unarmed, 1000)).toBeUndefined();
  });

  it("floors at zero when past deadline", () => {
    expect(podiumAuditSecondsRemaining(1, timers, 3000)).toBe(0);
  });
});

describe("readPodiumTimerSecFromMulticall", () => {
  it("reads extension / initial / cap slots per category", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      status: "success" as const,
      result: BigInt((i + 1) * 60),
    }));
    expect(readPodiumTimerSecFromMulticall(rows, 0, 0)).toBe(60);
    expect(readPodiumTimerSecFromMulticall(rows, 1, 1)).toBe(300);
    expect(readPodiumTimerSecFromMulticall(rows, 3, 2)).toBe(720);
  });
});
