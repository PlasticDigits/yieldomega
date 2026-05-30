// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { buySpendEnvelopeFillRatio, formatBuyAge } from "./timeArenaBuyDisplay";
import type { BuyItem } from "./indexerApi";
import { WAD } from "./timeArenaMath";

describe("buySpendEnvelopeFillRatio", () => {
  const env = {
    charmPriceWad: WAD,
    minCharmWad: WAD,
    maxCharmWad: 10n * WAD,
  };

  it("returns null when max spend does not exceed min", () => {
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
    expect(
      buySpendEnvelopeFillRatio(buy, {
        charmPriceWad: WAD,
        minCharmWad: 10n * WAD,
        maxCharmWad: 10n * WAD,
      }),
    ).toBeNull();
  });

  it("returns a ratio in [0,1] for mid-band spend", () => {
    const buy: BuyItem = {
      block_number: "1",
      tx_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      log_index: 0,
      buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
      amount: (5n * WAD).toString(),
      charm_wad: (5n * WAD).toString(),
      price_per_charm_wad: WAD.toString(),
      new_deadline: "1",
      total_raised_after: "1",
      buy_index: "1",
    };
    const r = buySpendEnvelopeFillRatio(buy, env);
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(1);
    }
  });

  it("maps the nominal minimum buy to 10% fill", () => {
    const buy: BuyItem = {
      block_number: "1",
      tx_hash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      log_index: 0,
      buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
      amount: WAD.toString(),
      charm_wad: WAD.toString(),
      price_per_charm_wad: WAD.toString(),
      new_deadline: "1",
      total_raised_after: "1",
      buy_index: "1",
    };

    expect(buySpendEnvelopeFillRatio(buy, env)).toBe(0.1);
  });

  it("maps the legal maximum buy to full fill", () => {
    const buy: BuyItem = {
      block_number: "1",
      tx_hash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      log_index: 0,
      buyer: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      amount: (10n * WAD).toString(),
      charm_wad: (10n * WAD).toString(),
      price_per_charm_wad: WAD.toString(),
      new_deadline: "1",
      total_raised_after: "1",
      buy_index: "1",
    };

    expect(buySpendEnvelopeFillRatio(buy, env)).toBe(1);
  });
});

describe("formatBuyAge", () => {
  it("formats seconds ago under one minute", () => {
    expect(formatBuyAge("1700000000", 1_700_000_007)).toBe("7s ago");
  });

  it("formats minutes, hours, and days for older buys", () => {
    expect(formatBuyAge("1700000000", 1_700_000_120)).toBe("2m ago");
    expect(formatBuyAge("1700000000", 1_700_007_200)).toBe("2h ago");
    expect(formatBuyAge("1700000000", 1_700_172_800)).toBe("2d ago");
  });

  it("clamps future timestamps to zero seconds ago", () => {
    expect(formatBuyAge("1700000100", 1_700_000_000)).toBe("0s ago");
  });
});
