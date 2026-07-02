// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { payTokenOptionsForSimpleBuy } from "./arenaPayTokenOptions";

describe("payTokenOptionsForSimpleBuy", () => {
  it("lists DOUB and reserve CL8Y separately on Arena v2", () => {
    const options = payTokenOptionsForSimpleBuy({ isArenaV2: true });
    expect(options.map((o) => o.value)).toEqual(["doub", "cl8y", "eth", "usdm", "cred"]);
    expect(options.map((o) => o.label)).toEqual(["DOUB", "CL8Y", "ETH", "USDM", "CRED"]);
  });

  it("keeps legacy CL8Y-only primary on pre-v2 surfaces", () => {
    const options = payTokenOptionsForSimpleBuy({ isArenaV2: false });
    expect(options.map((o) => o.value)).toEqual(["cl8y", "eth", "usdm"]);
    expect(options.map((o) => o.label)).toEqual(["CL8Y", "ETH", "USDM"]);
  });
});
