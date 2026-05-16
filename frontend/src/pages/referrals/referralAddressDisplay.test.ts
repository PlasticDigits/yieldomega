// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatOwnerCodeHash, truncateHexAddress } from "./referralAddressDisplay";

describe("formatOwnerCodeHash", () => {
  it("pads bigint to 32-byte hex", () => {
    expect(formatOwnerCodeHash(1n)).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    );
  });

  it("lowercases hex string", () => {
    expect(formatOwnerCodeHash("0xABCDEF0000000000000000000000000000000000000000000000000000000001")).toBe(
      "0xabcdef0000000000000000000000000000000000000000000000000000000001",
    );
  });
});

describe("truncateHexAddress", () => {
  it("shortens long addresses", () => {
    const a = "0xdddddddddddddddddddddddddddddddddddddddd";
    expect(truncateHexAddress(a, 6, 4)).toBe("0xdddddd…dddd");
  });

  it("returns short strings unchanged", () => {
    expect(truncateHexAddress("0xabc")).toBe("0xabc");
  });
});
