// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import { peerBuyHeadSfxTick } from "./peerBuyHeadSfxTick";

function buy(tx: string, buyer = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"): BuyItem {
  return {
    block_number: "1",
    tx_hash: tx,
    log_index: 0,
    buyer,
    amount: "1",
    charm_wad: "1",
    price_per_charm_wad: "1",
    new_deadline: "1",
    total_raised_after: "1",
    buy_index: "1",
  };
}

describe("peerBuyHeadSfxTick", () => {
  it("seeds on first head without play", () => {
    const h = buy("0xaa");
    expect(
      peerBuyHeadSfxTick({
        previousHeadTx: null,
        head: h,
        walletAddress: undefined,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "seed", nextHeadTx: "0xaa" });
  });

  it("plays on new head when no wallet", () => {
    const h = buy("0xbb");
    expect(
      peerBuyHeadSfxTick({
        previousHeadTx: "0xaa",
        head: h,
        walletAddress: undefined,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "newHead", nextHeadTx: "0xbb", play: true });
  });

  it("does not play when new head is self", () => {
    const me = "0xcccccccccccccccccccccccccccccccccccccccc";
    const h = buy("0xdd", me);
    expect(
      peerBuyHeadSfxTick({
        previousHeadTx: "0xaa",
        head: h,
        walletAddress: me,
        reduceMotion: false,
      }),
    ).toEqual({ kind: "newHead", nextHeadTx: "0xdd", play: false });
  });

  it("noop when reduceMotion", () => {
    expect(
      peerBuyHeadSfxTick({
        previousHeadTx: null,
        head: buy("0x1"),
        walletAddress: undefined,
        reduceMotion: true,
      }).kind,
    ).toBe("noop");
  });

  it("noop when head missing", () => {
    expect(
      peerBuyHeadSfxTick({
        previousHeadTx: "0xaa",
        head: null,
        walletAddress: undefined,
        reduceMotion: false,
      }).kind,
    ).toBe("noop");
  });
});
