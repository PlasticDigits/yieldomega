// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import { lastBuyHeadShakeTick } from "./useLastBuyHeadShakeNonce";

function buy(tx: string, logIndex = 0): BuyItem {
  return {
    block_number: "1",
    tx_hash: tx,
    log_index: logIndex,
    buyer: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    amount: "1",
    charm_wad: "1",
    price_per_charm_wad: "1",
    new_deadline: "1",
    total_raised_after: "1",
    buy_index: "1",
  };
}

describe("lastBuyHeadShakeTick", () => {
  it("seeds on first head without shake", () => {
    expect(
      lastBuyHeadShakeTick({
        previousHeadId: null,
        head: buy("0xaa"),
      }),
    ).toEqual({ kind: "seed", nextHeadId: "0xaa-0" });
  });

  it("shakes on new head", () => {
    expect(
      lastBuyHeadShakeTick({
        previousHeadId: "0xaa-0",
        head: buy("0xbb"),
      }),
    ).toEqual({ kind: "shake", nextHeadId: "0xbb-0" });
  });

  it("noop when head unchanged", () => {
    expect(
      lastBuyHeadShakeTick({
        previousHeadId: "0xaa-0",
        head: buy("0xaa"),
      }).kind,
    ).toBe("noop");
  });

  it("noop when head missing", () => {
    expect(
      lastBuyHeadShakeTick({
        previousHeadId: "0xaa-0",
        head: null,
      }).kind,
    ).toBe("noop");
  });
});
