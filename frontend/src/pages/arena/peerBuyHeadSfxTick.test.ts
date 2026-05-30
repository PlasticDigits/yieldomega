// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import { peerBuyHeadSfxId, peerBuyHeadSfxTick } from "./peerBuyHeadSfxTick";

function buy(tx: string, logIndex = 0, buyer = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"): BuyItem {
  return {
    block_number: "1",
    tx_hash: tx,
    log_index: logIndex,
    buyer,
    amount: "1",
    charm_wad: "1",
    price_per_charm_wad: "1",
    new_deadline: "1",
    total_raised_after: "1",
    buy_index: "1",
  };
}

describe("peerBuyHeadSfxId", () => {
  it("keys buys by tx hash and log index", () => {
    expect(peerBuyHeadSfxId(buy("0xaa", 3))).toBe("0xaa-3");
  });
});

describe("peerBuyHeadSfxTick", () => {
  it("seeds on first head without play", () => {
    const h = buy("0xaa");
    expect(
      peerBuyHeadSfxTick({
        previousHeadId: null,
        head: h,
        walletAddress: undefined,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "seed", nextHeadId: "0xaa-0" });
  });

  it("plays on new head when no wallet", () => {
    const h = buy("0xbb");
    expect(
      peerBuyHeadSfxTick({
        previousHeadId: "0xaa-0",
        head: h,
        walletAddress: undefined,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "newHead", nextHeadId: "0xbb-0", play: true });
  });

  it("does not play when new head is self", () => {
    const me = "0xcccccccccccccccccccccccccccccccccccccccc";
    const h = buy("0xdd", 0, me);
    expect(
      peerBuyHeadSfxTick({
        previousHeadId: "0xaa-0",
        head: h,
        walletAddress: me,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "newHead", nextHeadId: "0xdd-0", play: false });
  });

  it("treats same tx with different log index as a new head", () => {
    const h2 = buy("0xee", 1);
    expect(
      peerBuyHeadSfxTick({
        previousHeadId: "0xee-0",
        head: h2,
        walletAddress: undefined,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "newHead", nextHeadId: "0xee-1", play: true });
  });

  it("noop when reduceMotion", () => {
    expect(
      peerBuyHeadSfxTick({
        previousHeadId: null,
        head: buy("0x1"),
        walletAddress: undefined,
        reduceMotion: true,
      }).kind,
    ).toBe("noop");
  });

  it("noop when head missing", () => {
    expect(
      peerBuyHeadSfxTick({
        previousHeadId: "0xaa-0",
        head: null,
        walletAddress: undefined,
        reduceMotion: false,
      }).kind,
    ).toBe("noop");
  });
});
