// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArenaActivityItem, BuyItem } from "@/lib/indexerApi";
import { ArenaLiveBuysActivitySection } from "./ArenaLiveBuysActivitySection";

const mockBuy: BuyItem = {
  block_number: "42",
  tx_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  log_index: 0,
  block_timestamp: "1700000000",
  buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
  amount: "1000000000000000000",
  charm_wad: "1000000000000000000",
  price_per_charm_wad: "1000000000000000000",
  new_deadline: "2000000000",
  total_raised_after: "5000000000000000000",
  buy_index: "1",
  actual_seconds_added: "120",
};

describe("ArenaLiveBuysActivitySection (GitLab #258)", () => {
  it("wires onOpenWalletProfile to live buy ticker buyer addresses", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaLiveBuysActivitySection, {
        recentBuys: [mockBuy],
        decimals: 18,
        tickerEnvelopeParams: null,
        cl8ySpendBounds: null,
        isOffline: false,
        buyPollLastOk: true,
        buysNextOffset: null,
        loadingMoreBuys: false,
        buyPagesExpanded: false,
        onLoadMore: () => {},
        onOpenWalletProfile: () => {},
      }),
    );
    expect(html).toContain("address-inline__profile-btn");
    expect(html).toContain("arena-simple__ticker-buyer");
    expect(html).toContain("Open wallet profile for 0xdddddddddddddddddddddddddddddddddddddddd");
  });
});

describe("ArenaLiveBuysActivitySection (GitLab #292)", () => {
  const activity: ArenaActivityItem[] = [
    {
      kind: "buy",
      actor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      amount_doub_wad: "1000000000000000000000",
      charm_wad: "1000000000000000000",
      seconds_delta: "120",
      timer_hard_reset: false,
      block_number: 45,
      tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      log_index: 0,
      block_timestamp: "1700000000",
    },
    {
      kind: "steal",
      actor: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      target: "0xcccccccccccccccccccccccccccccccccccccccc",
      amount_doub_wad: "1000000000000000000000",
      bp_delta: "75",
      limit_bypass: true,
      block_number: 44,
      tx_hash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      log_index: 2,
      block_timestamp: "1700000000",
    },
    {
      kind: "guard",
      actor: "0xdddddddddddddddddddddddddddddddddddddddd",
      amount_doub_wad: "10000000000000000000000",
      guard_until: "1700003600",
      block_number: 43,
      tx_hash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      log_index: 1,
      block_timestamp: "1700000000",
    },
    {
      kind: "revenge",
      actor: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      target: "0xffffffffffffffffffffffffffffffffffffffff",
      amount_doub_wad: "1000000000000000000000",
      bp_delta: "50",
      block_number: 42,
      tx_hash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      log_index: 3,
      block_timestamp: "1700000000",
    },
  ];

  it("renders recent action kinds with DOUB, BP, and timer deltas", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaLiveBuysActivitySection, {
        recentBuys: [],
        recentActivity: activity,
        decimals: 18,
        tickerEnvelopeParams: null,
        cl8ySpendBounds: null,
        isOffline: false,
        buyPollLastOk: true,
        buysNextOffset: null,
        loadingMoreBuys: false,
        buyPagesExpanded: false,
        onLoadMore: () => {},
        onOpenWalletProfile: () => {},
      }),
    );

    expect(html).toContain("WarBow steal + bypass");
    expect(html).toContain("WarBow guard");
    expect(html).toContain("WarBow revenge");
    expect(html).toContain("DOUB buy");
    expect(html).toContain("DOUB");
    expect(html).toContain("+120s");
    expect(html).toContain("±75 BP");
    expect(html).toContain("Guard until");
    expect(html).toContain('address-inline__label">aaaaaa<');
    expect(html).not.toContain("CL8Y");
  });
});
