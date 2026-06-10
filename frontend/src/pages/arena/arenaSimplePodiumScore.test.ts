// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import {
  formatSimplePodiumScoreLine,
  formatViewerPodiumScoreLine,
  resolveViewerPodiumValueRaw,
} from "./arenaSimplePodiumScore";
import type { PodiumReadRow } from "./usePodiumReads";

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

function buy(partial: Partial<BuyItem> & Pick<BuyItem, "buyer" | "block_timestamp">): BuyItem {
  return {
    block_number: "1",
    tx_hash: "0xabc",
    log_index: 0,
    amount: "0",
    charm_wad: "0",
    price_per_charm_wad: "0",
    new_deadline: "0",
    total_raised_after: "0",
    buy_index: "1",
    ...partial,
  };
}

describe("formatSimplePodiumScoreLine", () => {
  it("Defended Streak compact mode shows em dash when streak value is zero or slot has no winner", () => {
    expect(
      formatSimplePodiumScoreLine(2, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "0",
        nowUnixSec: 0,
        compact: true,
      }),
    ).toBe("—");
    expect(
      formatSimplePodiumScoreLine(2, 0, {
        winner: "0x0000000000000000000000000000000000000000",
        winnerReady: false,
        valueRaw: "0",
        nowUnixSec: 0,
        compact: true,
      }),
    ).toBe("—");
  });

  it("Defended Streak uses guidance copy when streak value is zero or slot has no winner", () => {
    expect(
      formatSimplePodiumScoreLine(2, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "0",
        nowUnixSec: 0,
      }),
    ).toBe("Starts Under 15 Min");
    expect(
      formatSimplePodiumScoreLine(2, 0, {
        winner: "0x0000000000000000000000000000000000000000",
        winnerReady: false,
        valueRaw: "0",
        nowUnixSec: 0,
      }),
    ).toBe("Starts Under 15 Min");
  });

  it("formats WarBow BP, defended streak, and time booster from raw values", () => {
    expect(
      formatSimplePodiumScoreLine(1, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "1200",
        nowUnixSec: 0,
      }),
    ).toBe("1.2k BP");
    expect(
      formatSimplePodiumScoreLine(2, 1, {
        winner: BOB,
        winnerReady: true,
        valueRaw: "4",
        nowUnixSec: 0,
      }),
    ).toBe("4 sequential buys");
    expect(
      formatSimplePodiumScoreLine(3, 2, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "60",
        nowUnixSec: 0,
      }),
    ).toBe("+01:00");
  });

  it("prefers indexer winnerBuySec for Last Buy", () => {
    expect(
      formatSimplePodiumScoreLine(0, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "3",
        nowUnixSec: 1_700_000_042,
        winnerBuySec: "1700000000",
      }),
    ).toBe("42s");
  });

  it("uses recentBuys head + block_timestamp for Last Buy when buyers align", () => {
    const recent: BuyItem[] = [
      buy({ buyer: ALICE, block_timestamp: "1700000000", log_index: 2 }),
      buy({ buyer: BOB, block_timestamp: "1699999990", log_index: 1 }),
    ];
    expect(
      formatSimplePodiumScoreLine(0, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "3",
        nowUnixSec: 1_700_000_007,
        recentBuys: recent,
      }),
    ).toBe("7s");
    expect(
      formatSimplePodiumScoreLine(0, 1, {
        winner: BOB,
        winnerReady: true,
        valueRaw: "2",
        nowUnixSec: 1_700_000_007,
        recentBuys: recent,
      }),
    ).toBe("17s");
  });

  it("returns em dash score when last-buy head does not match the podium wallet", () => {
    const recent: BuyItem[] = [buy({ buyer: BOB, block_timestamp: "1700000000" })];
    expect(
      formatSimplePodiumScoreLine(0, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "3",
        nowUnixSec: 1_700_000_060,
        recentBuys: recent,
      }),
    ).toBe("—");
  });

  it("returns em dash for zero time booster score", () => {
    expect(
      formatSimplePodiumScoreLine(3, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "0",
        nowUnixSec: 0,
      }),
    ).toBe("—");
  });

  it("resolveViewerPodiumValueRaw prefers on-podium values for the connected wallet", () => {
    const row: PodiumReadRow = {
      winners: [ALICE, BOB, "0x0000000000000000000000000000000000000000"],
      values: ["900", "500", "0"],
    };
    expect(resolveViewerPodiumValueRaw(1, row, BOB, {})).toBe("500");
    expect(resolveViewerPodiumValueRaw(1, row, ALICE, {})).toBe("900");
  });

  it("formatViewerPodiumScoreLine mirrors podium score copy for the connected wallet", () => {
    expect(
      formatViewerPodiumScoreLine(1, "900", {
        nowUnixSec: 0,
        walletConnected: true,
      }),
    ).toBe("900 BP");
    expect(
      formatViewerPodiumScoreLine(1, null, {
        nowUnixSec: 0,
        walletConnected: false,
      }),
    ).toBe("—");
  });

  it("returns em dash when wallet slot is empty", () => {
    expect(
      formatSimplePodiumScoreLine(1, 0, {
        winner: "0x0000000000000000000000000000000000000000",
        winnerReady: false,
        valueRaw: "0",
        nowUnixSec: 0,
      }),
    ).toBe("—");
  });
});
