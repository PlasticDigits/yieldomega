// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import { formatSimplePodiumScoreLine } from "./timeCurveSimplePodiumScore";

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
  it("formats WarBow BP, defended streak, and time booster from raw values", () => {
    expect(
      formatSimplePodiumScoreLine(1, 0, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "1200",
        nowUnixSec: 0,
      }),
    ).toBe("Score: 1200 Battle Points");
    expect(
      formatSimplePodiumScoreLine(2, 1, {
        winner: BOB,
        winnerReady: true,
        valueRaw: "4",
        nowUnixSec: 0,
      }),
    ).toBe("Score: 4 sequential buys");
    expect(
      formatSimplePodiumScoreLine(3, 2, {
        winner: ALICE,
        winnerReady: true,
        valueRaw: "60",
        nowUnixSec: 0,
      }),
    ).toBe("Score: 60s added");
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
    ).toBe("Score: 7 seconds ago");
    expect(
      formatSimplePodiumScoreLine(0, 1, {
        winner: BOB,
        winnerReady: true,
        valueRaw: "2",
        nowUnixSec: 1_700_000_007,
        recentBuys: recent,
      }),
    ).toBe("Score: 17 seconds ago");
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
    ).toBe("Score: —");
  });

  it("returns em dash when wallet slot is empty", () => {
    expect(
      formatSimplePodiumScoreLine(1, 0, {
        winner: "0x0000000000000000000000000000000000000000",
        winnerReady: false,
        valueRaw: "0",
        nowUnixSec: 0,
      }),
    ).toBe("Score: —");
  });
});
