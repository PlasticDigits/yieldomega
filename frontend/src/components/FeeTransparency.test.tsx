// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/addresses", () => ({
  addresses: {
    timeArena: "0x1111111111111111111111111111111111111111",
    podiumVaults: "0x2222222222222222222222222222222222222222",
    adminSellVault: "0x3333333333333333333333333333333333333333",
  },
}));

vi.mock("@/lib/explorer", () => ({
  explorerAddressUrl: (address: string) => `https://explorer.example/address/${address}`,
}));

import { FeeTransparency } from "@/components/FeeTransparency";

describe("FeeTransparency (GitLab #293 / #300)", () => {
  it("renders 100% podium routing and blockie explorer address rows", () => {
    const html = renderToStaticMarkup(createElement(FeeTransparency));

    expect(html).toContain("Arena DOUB routing");
    expect(html).toContain("<strong>100%</strong>");
    expect(html).toContain("<strong>25%</strong>");
    expect(html).toContain("<strong>70/20/10</strong>");
    expect(html).not.toContain("<strong>30%</strong>");
    expect(html).toContain("arena-vault-addresses__row");
    expect(html).toContain("address-inline__blockie");
    expect(html).toContain("address-inline__label\">111111<");
    expect(html).toContain("https://explorer.example/address/0x1111111111111111111111111111111111111111");
  });
});
