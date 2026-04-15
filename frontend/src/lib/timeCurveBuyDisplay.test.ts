// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { buySpendEnvelopeFillRatio } from "./timeCurveBuyDisplay";
import type { BuyItem } from "./indexerApi";
import { WAD } from "./timeCurveMath";

describe("buySpendEnvelopeFillRatio", () => {
  const env = {
    saleStartSec: 1_000_000,
    charmEnvelopeRefWad: WAD,
    growthRateWad: 0n,
    basePriceWad: WAD,
    dailyIncrementWad: 0n,
  };

  it("returns null without block_timestamp", () => {
    const buy: BuyItem = {
      block_number: "1",
      tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      log_index: 0,
      buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
      amount: WAD.toString(),
      charm_wad: WAD.toString(),
      price_per_charm_wad: WAD.toString(),
      new_deadline: "1",
      total_raised_after: "1",
      buy_index: "1",
    };
    expect(buySpendEnvelopeFillRatio(buy, env)).toBeNull();
  });

  it("returns a ratio in [0,1] when block time and amount are present", () => {
    const buy: BuyItem = {
      block_number: "1",
      tx_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      log_index: 0,
      buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
      amount: WAD.toString(),
      charm_wad: WAD.toString(),
      price_per_charm_wad: WAD.toString(),
      new_deadline: "1",
      total_raised_after: "1",
      buy_index: "1",
      block_timestamp: String(env.saleStartSec + 3600),
    };
    const r = buySpendEnvelopeFillRatio(buy, env);
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });
});
