// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { normalizeIndexerBaseUrl, parseHexAddress } from "./addresses";

describe("parseHexAddress", () => {
  it("accepts valid 0x + 40 hex", () => {
    const a = "0x" + "a".repeat(40);
    expect(parseHexAddress(a)).toBe(a);
  });

  it("trims whitespace", () => {
    const inner = "0x" + "b".repeat(40);
    expect(parseHexAddress(`  ${inner}  `)).toBe(inner);
  });

  it("rejects wrong length, missing prefix, and non-hex", () => {
    expect(parseHexAddress("0xabc")).toBeUndefined();
    expect(parseHexAddress("10".repeat(21))).toBeUndefined();
    expect(parseHexAddress("0x" + "g".repeat(40))).toBeUndefined();
    expect(parseHexAddress(undefined)).toBeUndefined();
    expect(parseHexAddress("")).toBeUndefined();
  });
});

describe("normalizeIndexerBaseUrl", () => {
  it("strips trailing slash and empty", () => {
    expect(normalizeIndexerBaseUrl("https://ix.example/api/")).toBe(
      "https://ix.example/api",
    );
    expect(normalizeIndexerBaseUrl("  https://x  ")).toBe("https://x");
    expect(normalizeIndexerBaseUrl(undefined)).toBeUndefined();
    expect(normalizeIndexerBaseUrl("   ")).toBeUndefined();
  });
});
