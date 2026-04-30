// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { explorerTxUrl } from "./explorer";

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
