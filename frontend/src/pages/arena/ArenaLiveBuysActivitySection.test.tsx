// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
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
