// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { shortAddress, walletDisplayFromMap } from "./addressFormat";

describe("walletDisplayFromMap", () => {
  it("prefers mapped names over truncated hex", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const fmt = walletDisplayFromMap(new Map([[addr.toLowerCase(), "alice.mega"]]));
    expect(fmt(addr, "—")).toBe("alice.mega");
  });

  it("falls back to shortAddress when no mapping", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const fmt = walletDisplayFromMap(new Map());
    expect(fmt(addr, "—")).toBe(shortAddress(addr, "—"));
  });
});
