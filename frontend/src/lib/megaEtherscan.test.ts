// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { megaEtherscanAddressUrl } from "./megaEtherscan";

describe("megaEtherscanAddressUrl", () => {
  it("aliases explorerAddressUrl and preserves viem-normalized address", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "");
    const a = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(megaEtherscanAddressUrl(a)).toBe(`https://mega.etherscan.io/address/${a}`);
  });

  it("respects VITE_EXPLORER_BASE_URL", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "https://custom.example/");
    const a = "0x" + "b".repeat(40);
    expect(megaEtherscanAddressUrl(a)).toBe(`https://custom.example/address/${a}`);
  });

  it("returns undefined for invalid input", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "");
    expect(megaEtherscanAddressUrl("0xbad")).toBeUndefined();
    expect(megaEtherscanAddressUrl("not-hex")).toBeUndefined();
  });
});
