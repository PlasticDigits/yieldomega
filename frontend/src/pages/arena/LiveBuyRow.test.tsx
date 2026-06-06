// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import { LiveBuyRow } from "./LiveBuyRow";

const BUYER = "0xdddddddddddddddddddddddddddddddddddddddd" as const;

const mockBuy: BuyItem = {
  block_number: "42",
  tx_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  log_index: 0,
  block_timestamp: "1700000000",
  buyer: BUYER,
  amount: "1000000000000000000",
  charm_wad: "1000000000000000000",
  price_per_charm_wad: "1000000000000000000",
  new_deadline: "2000000000",
  total_raised_after: "5000000000000000000",
  buy_index: "1",
  actual_seconds_added: "120",
};

describe("LiveBuyRow (GitLab #258)", () => {
  it("renders explorer link for buyer when onOpenProfile is unset", () => {
    const html = renderToStaticMarkup(
      createElement(LiveBuyRow, {
        buy: mockBuy,
        formatWallet: (addr, fallback) => addr?.slice(0, 10) ?? fallback,
        nowUnixSec: 1_700_000_100,
        envelopeParams: null,
        variant: "hero",
      }),
    );
    expect(html).toContain("cursor-external-link");
    expect(html).toContain('address-inline__label">dddddd<');
    expect(html).not.toMatch(/address-inline__label">0x/);
    expect(html).not.toContain("address-inline__profile-btn");
  });

  it("renders profile button for buyer when onOpenProfile is set", () => {
    const html = renderToStaticMarkup(
      createElement(LiveBuyRow, {
        buy: mockBuy,
        formatWallet: (addr, fallback) => addr?.slice(0, 10) ?? fallback,
        nowUnixSec: 1_700_000_100,
        envelopeParams: null,
        variant: "modal",
        onOpenProfile: () => {},
      }),
    );
    expect(html).toContain("address-inline__profile-btn");
    expect(html).toContain(`Open wallet profile for ${BUYER}`);
    expect(html).not.toContain("cursor-external-link");
  });
});
