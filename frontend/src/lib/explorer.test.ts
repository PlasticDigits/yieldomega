// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { explorerAddressUrl, explorerTxUrl } from "./explorer";

describe("explorerTxUrl", () => {
  it("defaults to MegaETH Etherscan when env base URL is unset", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "");
    const h = "0x" + "a".repeat(64);
    expect(explorerTxUrl(h)).toBe(`https://mega.etherscan.io/tx/${h}`);
  });

  it("builds tx path and strips trailing slash on base", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "https://explorer.example/");
    const h = "0x" + "b".repeat(64);
    expect(explorerTxUrl(h)).toBe(`https://explorer.example/tx/${h}`);
  });

  it("rejects non-hex or wrong-length hashes", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "https://explorer.example");
    expect(explorerTxUrl("0xbad")).toBeUndefined();
    expect(explorerTxUrl("not-a-hash")).toBeUndefined();
  });
});

describe("explorerAddressUrl", () => {
  it("defaults to MegaETH Etherscan when env base URL is unset", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "");
    const a = "0x" + "d".repeat(40);
    expect(explorerAddressUrl(a)).toBe(`https://mega.etherscan.io/address/${a}`);
  });

  it("builds address path and strips trailing slash on base", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "https://explorer.example/");
    const a = "0x" + "e".repeat(40);
    expect(explorerAddressUrl(a)).toBe(`https://explorer.example/address/${a}`);
  });

  it("rejects invalid or non-address strings", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL", "https://explorer.example");
    expect(explorerAddressUrl("0xbad")).toBeUndefined();
    expect(explorerAddressUrl("not-an-address")).toBeUndefined();
  });
});
