// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { truncateHexAddress } from "./referralAddressDisplay";

describe("truncateHexAddress", () => {
  it("shortens long addresses", () => {
    const a = "0xdddddddddddddddddddddddddddddddddddddddd";
    expect(truncateHexAddress(a, 6, 4)).toBe("0xdddddd…dddd");
  });

  it("returns short strings unchanged", () => {
    expect(truncateHexAddress("0xabc")).toBe("0xabc");
  });
});
