// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { abbreviateAddressEnds, addressLast6Hex, addressTailHex, shortAddress, walletDisplayFromMap } from "./addressFormat";

describe("addressTailHex", () => {
  it("returns the requested trailing run for a standard address", () => {
    expect(addressTailHex("0x1234567890123456789012345678901234567890", 4)).toBe("7890");
    expect(addressTailHex("0x1234567890123456789012345678901234567890", 6)).toBe("567890");
  });

  it("returns empty string for non-standard addresses", () => {
    expect(addressTailHex("0x1234", 6)).toBe("");
  });
});

describe("addressLast6Hex", () => {
  it("returns last six hex digits without 0x or ellipsis", () => {
    expect(addressLast6Hex("0x1234567890123456789012345678901234567890")).toBe("567890");
  });

  it("returns empty string for non-standard addresses", () => {
    expect(addressLast6Hex("0x1234")).toBe("");
  });
});

describe("abbreviateAddressEnds", () => {
  it("uses first four and last four characters with ellipsis when long enough", () => {
    expect(abbreviateAddressEnds("0x111122223333444455556666777788889999AaBb")).toBe("0x11…AaBb");
  });

  it("returns trimmed input unchanged when shortening would collide", () => {
    expect(abbreviateAddressEnds("0x12345678")).toBe("0x12345678");
  });
});

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
