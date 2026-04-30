// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { megaEtherscanAddressUrl } from "./megaEtherscan";

describe("megaEtherscanAddressUrl", () => {
  it("builds lowercase /address/{addr} URLs for valid hex", () => {
    const a = "0xAaBbCcDd11223344556677889900aAbBcCdDeEfF";
    expect(megaEtherscanAddressUrl(a)).toBe(
      "https://mega.etherscan.io/address/0xaabbccdd11223344556677889900aabbccddeeff",
    );
  });

  it("returns undefined for invalid input", () => {
    expect(megaEtherscanAddressUrl("0xbad")).toBeUndefined();
    expect(megaEtherscanAddressUrl("not-hex")).toBeUndefined();
  });
});
